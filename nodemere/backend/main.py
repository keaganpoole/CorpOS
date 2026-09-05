# main.py
  
import os
import logging
import stripe
import json
import re
import time
import asyncio
import math
import requests
import base64
import binascii
from dataclasses import replace
import hmac
from html import escape as escape_html
from types import SimpleNamespace
from uuid import UUID, uuid4
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from datetime import date, datetime, timezone, timedelta
from typing import List, Optional, Literal
from urllib.parse import urlsplit, urlunsplit
from email.utils import parsedate_to_datetime
from zoneinfo import ZoneInfo
from .privacy import (configure_private_logging, correlation_id, event_metadata, remove_secrets,
    workflow_snapshot, execution_progress, UploadLimitMiddleware)
from .audit import begin_request as begin_audit_request, finish_request as finish_audit_request

SUPPRESSED_ACCESS_LOG_PATHS = {
    "/api/session",
    "/api/control-state",
    "/api/logs",
    "/api/events/live-pulse",
    "/api/agents",
    "/api/system/summary",
    "/api/pipeline",
    "/api/cron",
    "/api/reactions",
    "/businesses/me/forwarding",
}
APPOINTMENT_ALLOWED_STATUSES = {"pending", "confirmed", "cancelled", "completed", "missed"}


class UvicornAccessFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        message = record.getMessage()
        if '"GET ' not in message:
            return True
        return not any(f'"GET {path}' in message for path in SUPPRESSED_ACCESS_LOG_PATHS)


# --- Logging Configuration ---
# Sets the root logger to output INFO level messages.
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(correlation_id)s - %(message)s')
configure_private_logging()
logging.info('main.startup.event_52')
# Silence HTTPX / HTTPCORE internal debug logs
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("hpack").setLevel(logging.WARNING)
for handler in logging.getLogger("uvicorn.access").handlers:
    handler.addFilter(UvicornAccessFilter())

# --- End Logging Configuration ---

from pydantic import BaseModel, Field, EmailStr
from fastapi import FastAPI, HTTPException, status, Depends, Request, Header, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import HTMLResponse, JSONResponse, Response
from gotrue.errors import AuthApiError
from collections import defaultdict
from fastapi import BackgroundTasks
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from jose import JWTError, jwt
from postgrest.exceptions import APIError
from .config import (
    supabase,
    supabase_admin,
    supabase_auth,
    stripe_webhook_secret,
    SECRET_KEY,
    ALGORITHM,
    TEST_MODE,
    STRIPE_REAL_TEST_MODE,
    STRIPE_LIVE_SECRET_KEY,
    STRIPE_TEST_SECRET_KEY,
    stripe_connect_client_id,
    stripe_connect_test_client_id,
    stripe_connect_redirect_uri,
    stripe_application_fee_percent,
    elevenlabs_webhook_secret,
    elevenlabs_api_key,
    elevenlabs_agent_id_inbound,
    elevenlabs_agent_id_outbound,
    internal_tool_secret,
    twilio_phone_number,
    twilio_account_sid,
    twilio_auth_token,
    twilio_api_key,
    twilio_api_secret,
    twilio_voice_webhook_url,
    google_client_id,
    google_client_secret,
    google_oauth_redirect_uri,
    system_gmail_sender_email,
    system_gmail_refresh_token,
    outlook_client_id,
    outlook_client_secret,
    outlook_authority,
    outlook_redirect_uri,
    outlook_scopes,
    microsoft_graph_base_url,
    frontend_base_url,
    verification_base_url,
)

 
from .models import (
    UserUpdate, UserResponse, AuthSignUpRequest, LeadCreate,
    LeadResponse, AuthLoginRequest, LeadUpdate, PurchaseCreate,
    PurchaseUpdate, PurchaseResponse, CampaignItemResponse,
    CampaignCreate, CampaignUpdate, CampaignResponse, AIAgentResponse,
    AdminSetting, RepLoginRequest, MoneyTablePlan, MoneyTableRep, RepResponse, RepUpdate,
    PasswordCreate, PasswordUpdate, PasswordResponse, PrizeCreate, PrizeUpdate, PrizeResponse,
    TierResponse, HelpdeskMessage, OAuthAccountCreate, OAuthAccountResponse,
    UserIntegrationUpdate, UserIntegrationResponse,
)
from .dependencies import get_current_user, get_current_user_for_recovery, get_current_rep
from .security import safe_oauth_return_to, script_safe_json, issue_internal_context, verify_internal_context
from .authorization import (Tenant, current_tenant, current_identity, resolve_tenant,
                            validate_references, require_record, owner_id as business_owner_id)
from .config import new_auth_client
from .permissions import require_permission, route_permission
from .scenario_engine import ScenarioEngine, validate_scenario_definition
from .verification_service import (
    complete_verification,
    create_verification_session,
    get_public_verification,
    get_verification_status,
)
from .document_service import DOCUMENT_BUCKET, create_document_request, get_document_request, get_document_request_status, store_document
from .email_delivery_service import (
    EmailDeliveryError,
    SystemGmailConfiguration,
    log_email_delivery_failure,
    send_secure_link_email,
)
from .contract_service import (
    clone_voice,
    create_contract,
    get_contract_public_state,
    record_checkbox_consent,
    save_cloned_receptionist_profile,
    sign_contract,
)
from .project_intelligence import get_project_intelligence, refresh_market_research
from .business_intelligence import get_business_intelligence
from .nest_events import MILESTONE_KEYS, claim_call_milestones, claim_nest_milestone, claim_payment_milestones, get_nest_history, record_call_nest_event, record_nest_event

try:
    from elevenlabs.client import ElevenLabs
except Exception:
    ElevenLabs = None

try:
    from twilio.request_validator import RequestValidator
except Exception:
    RequestValidator = None

# --------------------------------------------------------------------------
# App Initialization
# --------------------------------------------------------------------------
app = FastAPI(title="Nodemere API")
app.add_middleware(UploadLimitMiddleware)
from .workforce import router as workforce_router
app.include_router(workforce_router)
from .record_reads import router as record_read_router
app.include_router(record_read_router)
NODEMERE_LEGAL_ACCEPTANCE_KEY = "nodemere_legal_acceptance_v2026_09_04"
NODEMERE_LEGAL_ACCEPTANCE_VERSION = "2026-09-04"
# scheduler = AsyncIOScheduler()
PAYMENT_TEST_MODE = TEST_MODE

CONTROL_STATE = {
    "runtime_mode": "running",
    "stage": "code_blue",
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
TENANT_CONTROL_STATES: dict[str, dict] = {}
TENANT_SESSION_STATES: dict[str, dict] = {}
ROUTE_HIT_EXCLUDE_PATHS = {
    "/api/events/live-pulse",
    "/api/logs",
}
scenario_engine: Optional[ScenarioEngine] = None
PENDING_FORWARDING_VERIFICATION_TASKS: dict[str, asyncio.Task] = {}


def next_live_event_id(prefix: Optional[str] = None) -> str:
    base_id = uuid4().hex
    return f"{prefix}-{base_id}" if prefix else base_id


def get_tenant_control_state(user_id: str) -> dict:
    return TENANT_CONTROL_STATES.setdefault(str(user_id), dict(CONTROL_STATE))


def get_tenant_session_state(user_id: str) -> dict:
    return TENANT_SESSION_STATES.setdefault(str(user_id), dict(SESSION_STATE))


def is_event_visible_to_user(event: dict, user_id: str) -> bool:
    payload = event.get("payload") if isinstance(event.get("payload"), dict) else {}
    return str(payload.get("user_id") or event.get("user_id") or "") == str(user_id)


def push_live_event(message: str, *, actor: str = "system", severity: str = "info", event_type: Optional[str] = None, payload: Optional[dict] = None):
    timestamp = datetime.now(timezone.utc).isoformat()
    event_payload = event_metadata(payload)
    message = "Application event"
    event = {
        "id": next_live_event_id(),
        "timestamp": timestamp,
        "message": message,
        "actor": actor,
        "severity": severity,
        "event_type": event_type or "system_event",
        "payload": event_payload,
    }
    LIVE_PULSE_EVENTS.insert(0, event)
    del LIVE_PULSE_EVENTS[50:]

    SYSTEM_LOG_EVENTS.insert(0, {
        "timestamp": timestamp,
        "level": severity,
        "source": actor,
        "message": message,
        "user_id": event_payload.get("user_id"),
    })
    del SYSTEM_LOG_EVENTS[100:]


def push_route_hit(method: str, endpoint: str, status_code: int, duration_ms: int, source: str, user_id: Optional[str] = None):
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
        "user_id": user_id,
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
        .select('id, user_id, name, phone, forwarding_config')
        .eq('user_id', user_id)
        .limit(1)
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")

    return hydrate_business_with_purchased_number_data(response.data[0])


def list_purchased_numbers_for_business(business_id: int) -> list[dict]:
    try:
        response = (
            supabase
            .table("purchased_numbers")
            .select("*")
            .eq("business_id", business_id)
            .order("created_at", desc=False)
            .execute()
        )
        return response.data or []
    except Exception as exc:
        logging.warning('main.list_purchased_numbers_for_business.event_314')
        return []


def get_active_purchased_number_for_business(business_id: int, *, kind: Optional[str] = "assigned_line") -> Optional[dict]:
    rows = list_purchased_numbers_for_business(business_id)
    filtered = [
        row for row in rows
        if (kind is None or row.get("kind") == kind)
        and str(row.get("status") or "").lower() != "released"
    ]
    active = next((row for row in filtered if row.get("is_active")), None)
    if active:
        return active
    return filtered[-1] if filtered else None


def hydrate_business_with_purchased_number_data(business: Optional[dict]) -> Optional[dict]:
    if not business:
        return business
    business_id = business.get("id")
    if business_id is None:
        return business

    purchased_numbers = list_purchased_numbers_for_business(int(business_id))
    active_assigned = next(
        (
            row for row in purchased_numbers
            if row.get("kind") == "assigned_line"
            and row.get("is_active")
            and str(row.get("status") or "").lower() not in {"released", "quality_failed"}
        ),
        None,
    )
    if active_assigned is None:
        candidates = [
            row for row in purchased_numbers
            if row.get("kind") == "assigned_line"
            and str(row.get("status") or "").lower() in {"active", "quality_checking", "inactive"}
        ]
        active_assigned = candidates[-1] if candidates else None

    hydrated = dict(business)
    hydrated["purchased_numbers"] = purchased_numbers
    hydrated["active_purchased_number"] = active_assigned
    hydrated["twilio_number"] = (active_assigned or {}).get("phone_number")
    hydrated["twilio_number_status"] = (active_assigned or {}).get("status")
    hydrated["twilio_number_label"] = (active_assigned or {}).get("friendly_name")
    hydrated["elevenlabs_phone_number_id"] = (active_assigned or {}).get("elevenlabs_phone_number_id")
    hydrated["twilio_number_quality_error"] = (active_assigned or {}).get("quality_failure_reason")
    hydrated["quality_check_status"] = (active_assigned or {}).get("quality_check_status")
    hydrated["quality_checked_at"] = (active_assigned or {}).get("quality_checked_at")
    hydrated["twilio_number_purchase_count"] = len([
        row for row in purchased_numbers
        if str(row.get("status") or "").lower() != "released"
    ])
    return hydrated


def get_system_config_row() -> dict:
    try:
        response = (
            supabase_admin
            .table("system_config")
            .select("total_allowed_number_purchases,verify_caller_id,test_mode")
            .limit(1)
            .execute()
        )
        return (response.data or [None])[0] or {}
    except Exception as exc:
        logging.warning('main.get_system_config_row.event_384')
        return {"_system_config_read_error": True}


def _coerce_boolean(value, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    return str(value).strip().lower() in {"1", "true", "t", "yes", "y", "on"}


def is_payment_test_mode() -> bool:
    """Read the database-controlled payment safety switch for each request."""
    global PAYMENT_TEST_MODE
    if TEST_MODE or STRIPE_REAL_TEST_MODE:
        PAYMENT_TEST_MODE = True
        stripe.api_key = STRIPE_TEST_SECRET_KEY
        return True
    row = get_system_config_row()
    if row.get("_system_config_read_error") or not row:
        # Fail closed: an unavailable safety switch must never enable live
        # billing by accident.
        PAYMENT_TEST_MODE = True
    elif "test_mode" in row and row.get("test_mode") is not None:
        PAYMENT_TEST_MODE = _coerce_boolean(row.get("test_mode"))
    stripe.api_key = STRIPE_TEST_SECRET_KEY if PAYMENT_TEST_MODE else STRIPE_LIVE_SECRET_KEY
    return PAYMENT_TEST_MODE


def is_real_stripe_test_mode() -> bool:
    return bool(STRIPE_REAL_TEST_MODE)


def _stripe_connect_client_id() -> Optional[str]:
    return stripe_connect_test_client_id if is_real_stripe_test_mode() else stripe_connect_client_id


def get_system_number_purchase_limit() -> int:
    row = get_system_config_row()
    value = row.get("total_allowed_number_purchases")
    if value in (None, ""):
        return 3
    try:
        return max(1, int(float(value)))
    except Exception:
        return 3


def get_system_verify_caller_id_enabled() -> bool:
    row = get_system_config_row()
    value = row.get("verify_caller_id")
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    return str(value).strip().lower() in {"1", "true", "t", "yes", "y", "on"}


def get_business_number_purchase_count(business: Optional[dict]) -> int:
    if not business:
        return 0
    try:
        if business.get("id") is not None:
            rows = list_purchased_numbers_for_business(int(business["id"]))
            return len([row for row in rows if str(row.get("status") or "").lower() != "released"])
        return max(0, int(float(business.get("twilio_number_purchase_count") or 0)))
    except Exception:
        return 0


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


def get_forwarding_entry(config: dict, entry_id: Optional[str] = None, source_number: Optional[str] = None) -> tuple[Optional[dict], Optional[int]]:
    numbers = (config or {}).get("numbers") or []
    normalized_source_number = normalize_phone_number(source_number) if source_number else None
    for index, entry in enumerate(numbers):
        if entry_id and entry.get("id") == entry_id:
            return entry, index
        if normalized_source_number and normalize_phone_number(entry.get("source_number")) == normalized_source_number:
            return entry, index
    return None, None


def get_active_forwarding_entry(config: dict) -> Optional[dict]:
    active_number_id = (config or {}).get("active_number_id")
    if active_number_id:
        entry, _ = get_forwarding_entry(config, entry_id=active_number_id)
        if entry:
            return entry
    numbers = (config or {}).get("numbers") or []
    return numbers[0] if numbers else None


def persist_business_forwarding_config(business_id: str, config: dict) -> dict:
    response = (
        supabase
        .table("businesses")
        .update({"forwarding_config": config})
        .eq("id", business_id)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to save forwarding settings")
    return response.data[0]


def save_purchased_number_record(
    business_id: int,
    phone_number: str,
    payload: dict,
    *,
    kind: str = "assigned_line",
) -> dict:
    normalized_phone_number = normalize_phone_number(phone_number)
    if not normalized_phone_number:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid phone number.")

    existing_response = (
        supabase
        .table("purchased_numbers")
        .select("*")
        .eq("business_id", business_id)
        .eq("phone_number", normalized_phone_number)
        .eq("kind", kind)
        .limit(1)
        .execute()
    )
    existing = (existing_response.data or [None])[0]
    now = datetime.now(timezone.utc).isoformat()
    next_payload = {
        **payload,
        "business_id": business_id,
        "phone_number": normalized_phone_number,
        "kind": kind,
        "updated_at": now,
    }
    if existing:
        response = (
            supabase
            .table("purchased_numbers")
            .update(next_payload)
            .eq("id", existing["id"])
            .execute()
        )
        return (response.data or [existing])[0]

    next_payload.setdefault("created_at", now)
    response = supabase.table("purchased_numbers").insert(next_payload).execute()
    return (response.data or [next_payload])[0]


def deactivate_other_purchased_numbers(business_id: int, keep_id: Optional[str], *, kind: str = "assigned_line") -> None:
    try:
        rows = list_purchased_numbers_for_business(business_id)
        for row in rows:
            if row.get("kind") != kind:
                continue
            if keep_id and str(row.get("id")) == str(keep_id):
                continue
            if row.get("is_active"):
                supabase.table("purchased_numbers").update({"is_active": False}).eq("id", row["id"]).execute()
    except Exception as exc:
        logging.warning('main.deactivate_other_purchased_numbers.event_558')


def get_account_call_routing() -> str:
    try:
        response = (
            supabase
            .table("account_settings")
            .select("call_routing")
            .limit(1)
            .execute()
        )
        row = (response.data or [None])[0]
        normalized = str((row or {}).get("call_routing") or "all").strip().lower()
        return normalized if normalized in {"inbound", "outbound", "all"} else "all"
    except Exception as exc:
        logging.warning('main.get_account_call_routing.event_574')
        return "all"


def get_account_call_routing_for_user(user_id: Optional[str]) -> str:
    if not user_id:
        return get_account_call_routing()
    try:
        response = (
            supabase
            .table("account_settings")
            .select("call_routing")
            .eq("user_id", str(user_id))
            .limit(1)
            .execute()
        )
        row = (response.data or [None])[0]
        normalized = str((row or {}).get("call_routing") or "all").strip().lower()
        return normalized if normalized in {"inbound", "outbound", "all"} else "all"
    except Exception as exc:
        logging.warning('main.get_account_call_routing_for_user.event_594')
        return "all"


def caller_authentication_allowed(*, user_id: Optional[str] = None, business_id: Optional[str] = None) -> bool:
    try:
        query = supabase.table("account_settings").select("preferences")
        if business_id is not None:
            query = query.eq("business_id", business_id)
        elif user_id:
            query = query.eq("user_id", str(user_id))
        response = query.limit(1).execute()
        row = (response.data or [None])[0] or {}
        preferences = row.get("preferences") if isinstance(row.get("preferences"), dict) else {}
        calls = preferences.get("calls") if isinstance(preferences.get("calls"), dict) else {}
        return calls.get("allow_caller_authentication") is True
    except Exception as exc:
        logging.warning('main.caller_authentication_allowed.event_611')
        return False


def call_routing_allows(direction: str, call_routing: Optional[str] = None) -> bool:
    normalized_direction = str(direction or "").strip().lower()
    normalized_routing = str(call_routing or get_account_call_routing()).strip().lower()
    if normalized_direction == "inbound":
        return normalized_routing in {"inbound", "all"}
    if normalized_direction in {"outbound", "outgoing"}:
        return normalized_routing in {"outbound", "all"}
    return False


def normalize_receptionist_direction(value: Optional[str]) -> str:
    normalized = str(value or "all").strip().lower()
    if normalized == "incoming":
        return "inbound"
    if normalized == "outgoing":
        return "outbound"
    if normalized in {"off", "disabled"}:
        return "none"
    return normalized if normalized in {"inbound", "outbound", "all", "none"} else "all"


def conflicting_receptionist_directions(direction: Optional[str]) -> list[str]:
    normalized = normalize_receptionist_direction(direction)
    if normalized == "all":
        return ["inbound", "outbound", "all"]
    if normalized == "inbound":
        return ["inbound", "all"]
    if normalized == "outbound":
        return ["outbound", "all"]
    return []


def clear_conflicting_receptionist_directions(agent_id: str, existing_agent: Optional[dict], next_direction: Optional[str]) -> None:
    conflicts = conflicting_receptionist_directions(next_direction)
    if not conflicts or not existing_agent:
        return

    try:
        query = (
            supabase
            .table("hired_receptionists")
            .update({"direction": "none", "status": "Idle"})
            .neq("id", agent_id)
            .in_("direction", conflicts)
        )
        if existing_agent.get("user_id"):
            query = query.eq("user_id", existing_agent.get("user_id"))
        elif existing_agent.get("business_id"):
            query = query.eq("business_id", existing_agent.get("business_id"))
        else:
            return
        query.execute()
    except Exception as exc:
        logger.warning('main.clear_conflicting_receptionist_directions.event_668')


def receptionist_direction_allows(call_direction: str, receptionist_direction: Optional[str]) -> bool:
    normalized_call_direction = str(call_direction or "").strip().lower()
    normalized_receptionist_direction = normalize_receptionist_direction(receptionist_direction)
    if normalized_call_direction == "inbound":
        return normalized_receptionist_direction in {"inbound", "all"}
    if normalized_call_direction in {"outbound", "outgoing"}:
        return normalized_receptionist_direction in {"outbound", "all"}
    return False


def derive_receptionist_status(
    current_status: Optional[str] = None,
    *,
    preserve_offline: bool = True,
    call_routing: Optional[str] = None,
    direction: Optional[str] = None,
    is_active: bool = True,
) -> str:
    normalized_current = str(current_status or "").strip().lower()
    if preserve_offline and normalized_current == "offline":
        return "Offline"
    if direction is not None:
        return "Online" if (
            receptionist_direction_allows("inbound", direction)
            or receptionist_direction_allows("outbound", direction)
        ) else "Idle"
    return "Online" if call_routing_allows("inbound", call_routing) or call_routing_allows("outbound", call_routing) else "Idle"


def maybe_auto_verify_business_forwarding(
    business: Optional[dict],
    *,
    called_number: Optional[str],
) -> Optional[dict]:
    if not business or not called_number:
        return None

    business_number_matches = set(build_phone_match_values(called_number)) & set(build_phone_match_values(business.get("twilio_number")))
    if not business_number_matches:
        return None

    config = normalize_forwarding_config(business.get("forwarding_config"))
    active_number_id = config.get("active_number_id")
    if not active_number_id:
        return None

    numbers = config.get("numbers", [])
    active_index = next((index for index, entry in enumerate(numbers) if entry.get("id") == active_number_id), None)
    if active_index is None:
        return None

    active_entry = numbers[active_index]
    if str(active_entry.get("status") or "").lower() != "pending_test":
        return None

    now = datetime.now(timezone.utc).isoformat()
    verified_entry = {
        **active_entry,
        "status": "verified",
        "verified_at": active_entry.get("verified_at") or now,
        "confirmed_enabled_at": active_entry.get("confirmed_enabled_at") or now,
        "updated_at": now,
    }
    numbers[active_index] = verified_entry

    supabase.table("businesses").update({"forwarding_config": config}).eq("id", business["id"]).execute()

    agent_id = verified_entry.get("agent_id")
    if agent_id:
        agent_lookup = (
            supabase
            .table("hired_receptionists")
            .select("id,status,is_active,direction")
            .eq("id", str(agent_id))
            .limit(1)
            .execute()
        )
        agent_row = (agent_lookup.data or [None])[0]
        if agent_row:
            next_status = derive_receptionist_status(
                agent_row.get("status"),
                preserve_offline=False,
                direction=agent_row.get("direction"),
            )
            supabase.table("hired_receptionists").update({"status": next_status}).eq("id", str(agent_id)).execute()

    push_live_event(
        "Business forwarding verified automatically.",
        actor="system",
        severity="info",
        event_type="business_forwarding_verified",
        payload={
            "business_id": business.get("id"),
            "called_number": normalize_phone_number(called_number),
            "source_number": verified_entry.get("source_number"),
            "entry_id": verified_entry.get("id"),
            "agent_id": verified_entry.get("agent_id"),
        },
    )

    return verified_entry


def get_business_forwarding_target_number(business: Optional[dict]) -> str:
    if business and business.get("twilio_number"):
        return str(business["twilio_number"])
    return ""


def get_global_forwarding_target_number() -> str:
    return twilio_phone_number or "+12073092121"


def extract_us_area_code(phone_value: Optional[str]) -> Optional[str]:
    normalized = normalize_phone_number(phone_value)
    if not normalized:
        return None
    digits = "".join(ch for ch in normalized if ch.isdigit())
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    if len(digits) != 10:
        return None
    return digits[:3]


def get_twilio_auth_tuple():
    if twilio_account_sid and twilio_auth_token:
        return (twilio_account_sid, twilio_auth_token)
    if twilio_api_key and twilio_api_secret:
        return (twilio_api_key, twilio_api_secret)
    return None


def get_twilio_voice_test_destination() -> str:
    return normalize_phone_number(os.environ.get("TWILIO_NUMBER_QUALITY_TEST_TO") or "+12076801233") or "+12076801233"


def get_public_backend_base_url() -> Optional[str]:
    explicit = os.environ.get("BACKEND_PUBLIC_URL")
    candidate = explicit or twilio_voice_webhook_url
    if not candidate:
        return None
    try:
        parts = urlsplit(candidate)
        if not parts.scheme or not parts.netloc:
            return None
        return urlunsplit((parts.scheme, parts.netloc, "", "", "")).rstrip("/")
    except Exception:
        return None


def get_twilio_caller_id_status_callback_url() -> Optional[str]:
    base_url = get_public_backend_base_url()
    if not base_url:
        return None
    return f"{base_url}/twilio/outgoing-caller-id/status"


def build_inbound_ai_disclosure(business_name: Optional[str], receptionist_name: Optional[str]) -> str:
    business_label = str(business_name or "the business").strip() or "the business"
    assistant_label = str(receptionist_name or "Nodemere assistant").strip() or "Nodemere assistant"
    return (
        f"Thank you for calling {business_label}. You are speaking with {assistant_label}, an AI assistant. "
        "This call may be recorded and transcribed. How may I help you?"
    )


async def verify_twilio_webhook_request(request: Request, expected_url: Optional[str]) -> None:
    if not twilio_auth_token or not expected_url or RequestValidator is None:
        logging.error('main.verify_twilio_webhook_request.event_845')
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Twilio webhook verification is not configured.",
        )
    signature = request.headers.get("x-twilio-signature")
    if not signature:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Twilio signature.")
    try:
        form = await request.form()
        parameters = {key: value for key, value in form.multi_items()}
        valid = RequestValidator(twilio_auth_token).validate(expected_url, parameters, signature)
    except Exception as exc:
        logging.warning('main.verify_twilio_webhook_request.event_858')
        valid = False
    if not valid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Twilio signature.")


def find_twilio_outgoing_caller_id(phone_number: Optional[str]) -> Optional[dict]:
    normalized = normalize_phone_number(phone_number)
    auth = get_twilio_auth_tuple()
    if not normalized or not twilio_account_sid or not auth:
        return None
    try:
        response = requests.get(
            f"https://api.twilio.com/2010-04-01/Accounts/{twilio_account_sid}/OutgoingCallerIds.json",
            params={"PhoneNumber": normalized},
            auth=auth,
            timeout=30,
        )
        response.raise_for_status()
        for item in (response.json() or {}).get("outgoing_caller_ids") or []:
            if normalize_phone_number(item.get("phone_number")) == normalized:
                return item
    except Exception as exc:
        logging.warning('main.find_twilio_outgoing_caller_id.event_881')
    return None


def start_twilio_outgoing_caller_id_verification(phone_number: str, *, friendly_name: Optional[str] = None, extension: Optional[str] = None) -> dict:
    normalized = normalize_phone_number(phone_number)
    auth = get_twilio_auth_tuple()
    if not normalized or not twilio_account_sid or not auth:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Twilio caller ID verification is not configured.")

    payload = {
        "PhoneNumber": normalized,
        "FriendlyName": friendly_name or normalized,
        "CallDelay": 2,
    }
    callback_url = get_twilio_caller_id_status_callback_url()
    if callback_url:
        payload["StatusCallback"] = callback_url
        payload["StatusCallbackMethod"] = "POST"
    if extension:
        payload["Extension"] = str(extension).strip()

    response = requests.post(
        f"https://api.twilio.com/2010-04-01/Accounts/{twilio_account_sid}/OutgoingCallerIds.json",
        data=payload,
        auth=auth,
        timeout=30,
    )
    response.raise_for_status()
    return response.json() or {}


def get_elevenlabs_headers() -> Optional[dict]:
    if not elevenlabs_api_key:
        return None
    return {
        "xi-api-key": elevenlabs_api_key,
        "Content-Type": "application/json",
    }


def delete_elevenlabs_phone_number(phone_number_id: Optional[str]) -> None:
    headers = get_elevenlabs_headers()
    if not headers or not phone_number_id:
        return
    try:
        logging.info('main.delete_elevenlabs_phone_number.event_927')
        response = requests.delete(
            f"https://api.elevenlabs.io/v1/convai/phone-numbers/{phone_number_id}",
            headers=headers,
            timeout=30,
        )
        response.raise_for_status()
    except Exception as exc:
        logging.warning('main.delete_elevenlabs_phone_number.event_935')


def search_available_twilio_numbers(
    *,
    area_code: Optional[str] = None,
    contains: Optional[str] = None,
    near_number: Optional[str] = None,
    region: Optional[str] = None,
    limit: int = 100,
) -> list[dict]:
    auth = get_twilio_auth_tuple()
    if not twilio_account_sid or not auth:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Twilio provisioning is not configured.",
        )

    query_limit = max(1, min(limit, 100))
    search_params = {
        "VoiceEnabled": "true",
        "SmsEnabled": "true",
        "ExcludeAllAddressRequired": "true",
        "Limit": query_limit,
    }
    if contains:
        search_params["Contains"] = str(contains).strip()
    normalized_near_number = None
    if near_number:
        normalized_near_number = normalize_phone_number(near_number)
        if normalized_near_number:
            search_params["NearNumber"] = normalized_near_number
            search_params["Distance"] = 100
    if not normalized_near_number and area_code and str(area_code).isdigit():
        search_params["AreaCode"] = str(area_code)[:3]
    if region:
        search_params["InRegion"] = str(region).strip()[:2].upper()

    search_url = f"https://api.twilio.com/2010-04-01/Accounts/{twilio_account_sid}/AvailablePhoneNumbers/US/Local.json"
    response = requests.get(search_url, params=search_params, auth=auth, timeout=30)
    if not response.ok:
        logging.error('main.search_available_twilio_numbers.event_976')
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail='The request could not be completed',
        )

    options = []
    for item in (response.json() or {}).get("available_phone_numbers") or []:
        options.append({
            "phone_number": item.get("phone_number"),
            "friendly_name": item.get("friendly_name"),
            "locality": item.get("locality"),
            "region": item.get("region"),
            "postal_code": item.get("postal_code"),
            "beta": item.get("beta"),
            "capabilities": item.get("capabilities") or {},
        })
    return options


def release_twilio_number_by_sid(incoming_phone_number_sid: Optional[str]) -> None:
    auth = get_twilio_auth_tuple()
    if not twilio_account_sid or not auth or not incoming_phone_number_sid:
        return
    try:
        logging.info('main.release_twilio_number_by_sid.event_1006')
        response = requests.delete(
            f"https://api.twilio.com/2010-04-01/Accounts/{twilio_account_sid}/IncomingPhoneNumbers/{incoming_phone_number_sid}.json",
            auth=auth,
            timeout=30,
        )
        response.raise_for_status()
    except Exception as exc:
        logging.warning('main.release_twilio_number_by_sid.event_1009')


def purchase_specific_twilio_number_for_business(business: dict, phone_number: str, label: Optional[str] = None) -> tuple[dict, dict, dict]:
    auth = get_twilio_auth_tuple()
    if not twilio_account_sid or not auth:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Twilio provisioning is not configured.",
        )

    purchase_count = get_business_number_purchase_count(business)
    purchase_limit = get_system_number_purchase_limit()
    if purchase_count >= purchase_limit:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This business has reached its number purchase limit.",
        )

    normalized_phone_number = normalize_phone_number(phone_number)
    if not normalized_phone_number:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Choose a valid phone number.")

    incoming_url = f"https://api.twilio.com/2010-04-01/Accounts/{twilio_account_sid}/IncomingPhoneNumbers.json"
    purchase_payload = {
        "PhoneNumber": normalized_phone_number,
        "FriendlyName": label or business.get("name") or f"Business {business.get('id')}",
    }
    logging.info('main.purchase_specific_twilio_number_for_business.event_1042')
    purchase_response = requests.post(incoming_url, data=purchase_payload, auth=auth, timeout=30)
    if not purchase_response.ok:
        detail = purchase_response.text
        logging.warning('main.purchase_specific_twilio_number_for_business.event_1046')
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail='The request could not be completed',
        )

    purchased = purchase_response.json() or {}
    logging.info('main.purchase_specific_twilio_number_for_business.event_1066')
    purchased_row = save_purchased_number_record(
        int(business["id"]),
        purchased.get("phone_number") or normalized_phone_number,
        {
            "friendly_name": purchased.get("friendly_name") or purchase_payload["FriendlyName"],
            "provider": "twilio",
            "status": "quality_checking",
            "is_active": False,
            "twilio_account_sid": twilio_account_sid,
            "twilio_incoming_phone_number_sid": purchased.get("sid"),
            "quality_check_status": "pending",
            "quality_failure_reason": None,
            "purchase_source": "modal",
            "assigned_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    updated_business = hydrate_business_with_purchased_number_data(business) or business
    return updated_business, purchased, purchased_row


def start_number_quality_test_call(phone_number_id: str, label: str) -> dict:
    headers = get_elevenlabs_headers()
    if not headers or not phone_number_id or not elevenlabs_agent_id_outbound:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Outbound quality testing is not configured.",
        )

    test_destination = get_twilio_voice_test_destination()
    logging.info('main.start_number_quality_test_call.event_1102')
    response = requests.post(
        "https://api.elevenlabs.io/v1/convai/twilio/outbound-call",
        headers=headers,
        json={
            "agent_id": elevenlabs_agent_id_outbound,
            "agent_phone_number_id": phone_number_id,
            "to_number": test_destination,
            "conversation_initiation_client_data": {
                "dynamic_variables": {
                    "company_name": label,
                    "autonomy_index": 1,
                    "direction": "outgoing",
                    "mission": "Outbound deliverability quality check",
                    "collection_required_fields": False,
                    "collection_service_id": False,
                    "collection_date": False,
                    "collection_time": False,
                    "collection_person_id": False,
                    "appointment_ready_to_create": False,
                },
            },
        },
        timeout=30,
    )
    response.raise_for_status()
    payload = response.json() or {}
    logging.info('main.start_number_quality_test_call.event_1135')
    return payload


async def wait_for_twilio_quality_test_result(call_sid: Optional[str], timeout_seconds: int = 18) -> dict:
    auth = get_twilio_auth_tuple()
    if not twilio_account_sid or not auth or not call_sid:
        return {
            "passed": False,
            "status": "failed",
            "technical_reason": "Missing Twilio call sid for quality check.",
        }

    terminal_fail_statuses = {"busy", "failed", "canceled"}
    success_statuses = {"completed", "in-progress", "ringing", "no-answer"}
    pending_statuses = {"queued", "initiated"}
    started = time.monotonic()
    poll_count = 0

    while time.monotonic() - started < timeout_seconds:
        poll_count += 1
        response = requests.get(
            f"https://api.twilio.com/2010-04-01/Accounts/{twilio_account_sid}/Calls/{call_sid}.json",
            auth=auth,
            timeout=30,
        )
        response.raise_for_status()
        call = response.json() or {}

        call_status = str(call.get("status") or "").strip().lower()
        duration_value = str(call.get("duration") or "").strip()
        answered_by = call.get("answered_by")

        try:
            duration_seconds = int(duration_value) if duration_value else 0
        except (TypeError, ValueError):
            duration_seconds = 0

        logging.info('main.wait_for_twilio_quality_test_result.event_1154')

        if call_status in success_statuses:
            logging.info('main.wait_for_twilio_quality_test_result.event_1146')
            return {
                "passed": True,
                "status": call_status,
                "duration_seconds": duration_seconds,
            }

        if duration_seconds > 0:
            logging.info('main.wait_for_twilio_quality_test_result.event_1160')
            return {
                "passed": True,
                "status": call_status or "completed",
                "duration_seconds": duration_seconds,
            }

        if call_status in terminal_fail_statuses:
            logging.warning('main.wait_for_twilio_quality_test_result.event_1174')
            return {
                "passed": False,
                "status": call_status,
                "technical_reason": f"Twilio reported {call_status}.",
            }

        if call_status not in pending_statuses and call_status:
            logging.info('main.wait_for_twilio_quality_test_result.event_1188')

        await asyncio.sleep(1.2)

    logging.warning('main.wait_for_twilio_quality_test_result.event_1234')
    return {
        "passed": False,
        "status": "timed_out",
        "technical_reason": "The quality check did not complete in time.",
    }


def parse_twilio_timestamp(value) -> Optional[datetime]:
    if not value:
        return None
    try:
        if isinstance(value, datetime):
            return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        parsed = parsedate_to_datetime(str(value))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except Exception:
        try:
            parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except Exception:
            return None


def twilio_call_matches_inbound_verification(call: Optional[dict], target_number: Optional[str], started_at: Optional[datetime]) -> bool:
    if not call or not target_number:
        return False
    if not (set(build_phone_match_values(call.get("to"))) & set(build_phone_match_values(target_number))):
        return False
    direction = str(call.get("direction") or "").strip().lower()
    if direction and "inbound" not in direction:
        return False
    created_at = parse_twilio_timestamp(call.get("date_created") or call.get("start_time") or call.get("date_updated"))
    if started_at and created_at and created_at < started_at:
        return False
    status_value = str(call.get("status") or "").strip().lower()
    return status_value in {"queued", "ringing", "in-progress", "completed", "busy", "no-answer"}


async def watch_twilio_inbound_call_for_forwarding_verification(business_id: int, entry_id: str, target_number: str, started_at_iso: str, timeout_seconds: int = 240):
    auth = get_twilio_auth_tuple()
    task_key = f"{business_id}:{entry_id}"
    started_at = parse_optional_datetime(started_at_iso) or datetime.now(timezone.utc)

    if not twilio_account_sid or not auth or not target_number:
        PENDING_FORWARDING_VERIFICATION_TASKS.pop(task_key, None)
        return

    try:
        deadline = time.monotonic() + timeout_seconds
        while time.monotonic() < deadline:
            business = load_business_by_id(business_id)
            if not business:
                return

            config = normalize_forwarding_config(business.get("forwarding_config"))
            active_entry = next((entry for entry in config.get("numbers", []) if entry.get("id") == entry_id), None)
            if not active_entry:
                return
            if str(active_entry.get("status") or "").lower() == "verified":
                return
            if str(active_entry.get("status") or "").lower() != "pending_test":
                return

            response = requests.get(
                f"https://api.twilio.com/2010-04-01/Accounts/{twilio_account_sid}/Calls.json",
                params={"To": normalize_phone_number(target_number) or target_number, "PageSize": 20},
                auth=auth,
                timeout=30,
            )
            response.raise_for_status()
            calls = (response.json() or {}).get("calls") or []

            matched_call = next(
                (call for call in calls if twilio_call_matches_inbound_verification(call, target_number, started_at)),
                None,
            )
            if matched_call:
                logging.info('main.watch_twilio_inbound_call_for_forwarding_verification.event_1247')
                maybe_auto_verify_business_forwarding(business, called_number=target_number)
                return

            await asyncio.sleep(4)
    except Exception as exc:
        logging.warning('main.watch_twilio_inbound_call_for_forwarding_verification.event_1282')
    finally:
        PENDING_FORWARDING_VERIFICATION_TASKS.pop(task_key, None)


def schedule_twilio_inbound_forwarding_verification_watch(business_id: int, entry_id: str, target_number: str, started_at_iso: str):
    task_key = f"{business_id}:{entry_id}"
    existing = PENDING_FORWARDING_VERIFICATION_TASKS.get(task_key)
    if existing and not existing.done():
        return
    PENDING_FORWARDING_VERIFICATION_TASKS[task_key] = asyncio.create_task(
        watch_twilio_inbound_call_for_forwarding_verification(
            business_id,
            entry_id,
            target_number,
            started_at_iso,
        )
    )


def find_recent_twilio_inbound_call(target_number: Optional[str], *, within_hours: int = 24) -> Optional[dict]:
    auth = get_twilio_auth_tuple()
    normalized_target = normalize_phone_number(target_number)
    if not twilio_account_sid or not auth or not normalized_target:
        return None

    try:
        response = requests.get(
            f"https://api.twilio.com/2010-04-01/Accounts/{twilio_account_sid}/Calls.json",
            params={"To": normalized_target, "PageSize": 20},
            auth=auth,
            timeout=30,
        )
        response.raise_for_status()
        calls = (response.json() or {}).get("calls") or []
    except Exception as exc:
        logging.warning('main.find_recent_twilio_inbound_call.event_1295')
        return None

    cutoff = datetime.now(timezone.utc) - timedelta(hours=max(1, within_hours))
    for call in calls:
        if not twilio_call_matches_inbound_verification(call, normalized_target, None):
            continue
        created_at = parse_twilio_timestamp(call.get("date_created") or call.get("start_time") or call.get("date_updated"))
        if created_at and created_at < cutoff:
            continue
        return call
    return None


def maybe_auto_verify_business_forwarding_from_recent_twilio_call(business: Optional[dict]) -> Optional[dict]:
    if not business:
        return None
    config = normalize_forwarding_config(business.get("forwarding_config"))
    active_number_id = config.get("active_number_id")
    if not active_number_id:
        return None
    active_entry = next((entry for entry in config.get("numbers", []) if entry.get("id") == active_number_id), None)
    if not active_entry:
        return None
    if str(active_entry.get("status") or "").lower() != "pending_test":
        return None
    target_number = active_entry.get("target_number") or business.get("twilio_number")
    matched_call = find_recent_twilio_inbound_call(target_number)
    if not matched_call:
        return None
    logging.info('main.maybe_auto_verify_business_forwarding_from_recent_twilio_call.event_1395')
    return maybe_auto_verify_business_forwarding(business, called_number=target_number)


def maybe_sync_business_caller_id_verification_from_twilio(business: Optional[dict]) -> Optional[dict]:
    if not business:
        return None
    config = normalize_forwarding_config(business.get("forwarding_config"))
    active_number_id = config.get("active_number_id")
    if not active_number_id:
        return None
    numbers = config.get("numbers", [])
    active_index = next((index for index, entry in enumerate(numbers) if entry.get("id") == active_number_id), None)
    if active_index is None:
        return None
    active_entry = numbers[active_index]
    if str(active_entry.get("status") or "").lower() != "verified":
        return None
    if str(active_entry.get("caller_id_verification_status") or "").lower() == "verified":
        return None
    last_checked_at_raw = active_entry.get("caller_id_last_checked_at")
    if last_checked_at_raw:
        try:
            last_checked_at = datetime.fromisoformat(str(last_checked_at_raw).replace("Z", "+00:00"))
            if datetime.now(timezone.utc) - last_checked_at < timedelta(minutes=5):
                return None
        except Exception:
            pass
    source_number = normalize_phone_number(active_entry.get("source_number"))
    if not source_number:
        return None
    verified_caller_id = find_twilio_outgoing_caller_id(source_number)
    now = datetime.now(timezone.utc).isoformat()
    if not verified_caller_id:
        numbers[active_index] = {
            **active_entry,
            "caller_id_last_checked_at": now,
            "updated_at": now,
        }
        config["numbers"] = numbers
        persist_business_forwarding_config(business["id"], config)
        return None
    phone_number_id = ensure_elevenlabs_outbound_caller_id(
        source_number,
        active_entry.get("source_label") or business.get("name") or "Verified Caller ID",
    )
    numbers[active_index] = {
        **active_entry,
        "caller_id_verification_status": "verified",
        "caller_id_phone_number": source_number,
        "caller_id_outgoing_caller_id_sid": verified_caller_id.get("sid"),
        "caller_id_verified_at": active_entry.get("caller_id_verified_at") or now,
        "caller_id_last_checked_at": now,
        "caller_id_validation_code": None,
        "caller_id_failure_reason": None,
        "caller_id_elevenlabs_phone_number_id": phone_number_id,
        "updated_at": now,
    }
    config["numbers"] = numbers
    persist_business_forwarding_config(business["id"], config)
    logging.info('main.maybe_sync_business_caller_id_verification_from_twilio.event_1460')
    return numbers[active_index]


def find_elevenlabs_phone_number(phone_number: Optional[str]) -> Optional[dict]:
    headers = get_elevenlabs_headers()
    normalized = normalize_phone_number(phone_number)
    if not headers or not normalized:
        return None

    try:
        response = requests.get(
            "https://api.elevenlabs.io/v1/convai/phone-numbers",
            headers=headers,
            timeout=30,
        )
        response.raise_for_status()
    except Exception as exc:
        logging.warning('main.find_elevenlabs_phone_number.event_1403')
        return None

    for item in response.json() or []:
        if normalize_phone_number(item.get("phone_number")) == normalized:
            return item
    return None


def import_elevenlabs_phone_number(phone_number: str, label: str) -> Optional[str]:
    headers = get_elevenlabs_headers()
    if not headers or not twilio_account_sid or not twilio_auth_token:
        return None

    payload = {
        "provider": "twilio",
        "label": label,
        "phone_number": phone_number,
        "sid": twilio_account_sid,
        "token": twilio_auth_token,
    }
    try:
        logging.info('main.import_elevenlabs_phone_number.event_1472')
        response = requests.post(
            "https://api.elevenlabs.io/v1/convai/phone-numbers",
            headers=headers,
            json=payload,
            timeout=60,
        )
        response.raise_for_status()
        phone_number_id = (response.json() or {}).get("phone_number_id")
        logging.info('main.import_elevenlabs_phone_number.event_1481')
        return phone_number_id
    except Exception as exc:
        logging.warning('main.import_elevenlabs_phone_number.event_1437')
        return None


def ensure_elevenlabs_outbound_caller_id(phone_number: str, label: str) -> Optional[str]:
    normalized = normalize_phone_number(phone_number)
    if not normalized:
        return None
    existing_phone = find_elevenlabs_phone_number(normalized)
    phone_number_id = existing_phone.get("phone_number_id") if existing_phone else None
    if phone_number_id:
        return str(phone_number_id)
    return import_elevenlabs_phone_number(normalized, label)


def assign_elevenlabs_phone_number_to_inbound_agent(phone_number_id: str) -> bool:
    headers = get_elevenlabs_headers()
    if not headers or not phone_number_id or not elevenlabs_agent_id_inbound:
        return False

    try:
        logging.info('main.assign_elevenlabs_phone_number_to_inbound_agent.event_1505')
        response = requests.patch(
            f"https://api.elevenlabs.io/v1/convai/phone-numbers/{phone_number_id}",
            headers=headers,
            json={"agent_id": elevenlabs_agent_id_inbound},
            timeout=60,
        )
        response.raise_for_status()
        logging.info('main.assign_elevenlabs_phone_number_to_inbound_agent.event_1517')
        return True
    except Exception as exc:
        logging.warning('main.assign_elevenlabs_phone_number_to_inbound_agent.event_1469')
        return False


def ensure_elevenlabs_phone_number_for_business(business: dict) -> dict:
    phone_number = normalize_phone_number(business.get("twilio_number"))
    if not phone_number:
        return business

    label = business.get("name") or business.get("twilio_number_label") or f"Business {business.get('id')}"
    existing_phone = find_elevenlabs_phone_number(phone_number)
    phone_number_id = existing_phone.get("phone_number_id") if existing_phone else None
    logging.info('main.ensure_elevenlabs_phone_number_for_business.event_1569')

    if not phone_number_id:
        phone_number_id = import_elevenlabs_phone_number(phone_number, label)
        if phone_number_id:
            existing_phone = {
                "phone_number_id": phone_number_id,
                "phone_number": phone_number,
                "assigned_agent": None,
            }

    if not phone_number_id:
        return business

    assigned_agent_id = ((existing_phone or {}).get("assigned_agent") or {}).get("agent_id")
    if elevenlabs_agent_id_inbound and assigned_agent_id != elevenlabs_agent_id_inbound:
        assign_elevenlabs_phone_number_to_inbound_agent(phone_number_id)

    active_row = get_active_purchased_number_for_business(int(business["id"]), kind="assigned_line")
    if active_row:
        save_purchased_number_record(
            int(business["id"]),
            phone_number,
            {
                "friendly_name": label,
                "status": "active",
                "is_active": True,
                "elevenlabs_phone_number_id": phone_number_id,
                "quality_check_status": "passed",
                "quality_failure_reason": None,
                "quality_checked_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        deactivate_other_purchased_numbers(int(business["id"]), active_row.get("id"), kind="assigned_line")

    updated_business = hydrate_business_with_purchased_number_data(business) or business

    push_live_event(
        "Dedicated Twilio number imported into ElevenLabs.",
        actor="system",
        severity="info",
        event_type="elevenlabs_phone_number_ready",
        payload={
            "business_id": business.get("id"),
            "twilio_number": phone_number,
            "phone_number_id": phone_number_id,
            "agent_id": elevenlabs_agent_id_inbound,
        },
    )
    return updated_business


def ensure_twilio_number_is_configured_for_business(business: dict) -> dict:
    if not business.get("twilio_number") or not twilio_voice_webhook_url:
        return business

    if str(business.get("twilio_number_status") or "").lower() == "active":
        return business

    auth = get_twilio_auth_tuple()
    if not twilio_account_sid or not auth:
        return business

    incoming_url = f"https://api.twilio.com/2010-04-01/Accounts/{twilio_account_sid}/IncomingPhoneNumbers.json"
    list_response = requests.get(
        incoming_url,
        params={"PhoneNumber": business.get("twilio_number")},
        auth=auth,
        timeout=30,
    )
    if not list_response.ok:
        logging.warning('main.ensure_twilio_number_is_configured_for_business.event_1607')
        return business

    phone_numbers = (list_response.json() or {}).get("incoming_phone_numbers") or []
    if not phone_numbers:
        logging.warning('main.ensure_twilio_number_is_configured_for_business.event_1612')
        return business

    incoming_sid = phone_numbers[0].get("sid")
    if not incoming_sid:
        return business

    update_url = f"https://api.twilio.com/2010-04-01/Accounts/{twilio_account_sid}/IncomingPhoneNumbers/{incoming_sid}.json"
    update_response = requests.post(
        update_url,
        data={
            "VoiceUrl": twilio_voice_webhook_url,
            "VoiceMethod": "POST",
        },
        auth=auth,
        timeout=30,
    )
    if not update_response.ok:
        logging.warning('main.ensure_twilio_number_is_configured_for_business.event_1630')
        return business

    save_purchased_number_record(
        int(business["id"]),
        business.get("twilio_number"),
        {
            "status": "active",
            "is_active": True,
            "twilio_incoming_phone_number_sid": incoming_sid,
        },
    )
    updated_business = hydrate_business_with_purchased_number_data(business) or business
    push_live_event(
        "Dedicated Twilio number activated for business.",
        actor="system",
        severity="info",
        event_type="twilio_number_activated",
        payload={
            "business_id": business.get("id"),
            "twilio_number": business.get("twilio_number"),
        },
    )
    return updated_business


def provision_twilio_number_for_business(business: dict):
    auth = get_twilio_auth_tuple()
    if not twilio_account_sid or not auth:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Twilio provisioning is not configured. Add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN (or TWILIO_API_SECRET).",
    )

    if business.get("twilio_number"):
        return ensure_elevenlabs_phone_number_for_business(business)

    area_code = extract_us_area_code(business.get("phone"))
    search_url = f"https://api.twilio.com/2010-04-01/Accounts/{twilio_account_sid}/AvailablePhoneNumbers/US/Local.json"
    search_params = {
        "VoiceEnabled": "true",
        "Limit": 1,
    }
    if area_code:
        search_params["AreaCode"] = area_code

    search_response = requests.get(search_url, params=search_params, auth=auth, timeout=30)
    if not search_response.ok:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail='The request could not be completed',
        )

    available_numbers = (search_response.json() or {}).get("available_phone_numbers") or []
    if not available_numbers and area_code:
        fallback_response = requests.get(
            search_url,
            params={"VoiceEnabled": "true", "Limit": 1},
            auth=auth,
            timeout=30,
        )
        if fallback_response.ok:
            available_numbers = (fallback_response.json() or {}).get("available_phone_numbers") or []

    if not available_numbers:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No Twilio phone numbers are currently available for provisioning.",
        )

    chosen_number = available_numbers[0]
    incoming_url = f"https://api.twilio.com/2010-04-01/Accounts/{twilio_account_sid}/IncomingPhoneNumbers.json"
    purchase_payload = {
        "PhoneNumber": chosen_number.get("phone_number"),
        "FriendlyName": business.get("name") or f"Business {business.get('id')}",
    }
    if twilio_voice_webhook_url:
        purchase_payload["VoiceUrl"] = twilio_voice_webhook_url
        purchase_payload["VoiceMethod"] = "POST"

    purchase_response = requests.post(incoming_url, data=purchase_payload, auth=auth, timeout=30)
    if not purchase_response.ok:
        detail = purchase_response.text
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail='The request could not be completed',
        )

    purchased = purchase_response.json() or {}
    assigned_number = purchased.get("phone_number") or chosen_number.get("phone_number")
    label = purchased.get("friendly_name") or business.get("name") or "Dedicated forwarding line"
    next_status = "assigned"

    update_response = (
        supabase
        .table("businesses")
        .update({
            "twilio_number": assigned_number,
            "twilio_number_status": next_status,
            "twilio_number_label": label,
        })
        .eq("id", business["id"])
        .execute()
    )

    updated_business = update_response.data[0] if update_response.data else {
        **business,
        "twilio_number": assigned_number,
        "twilio_number_status": next_status,
        "twilio_number_label": label,
    }

    push_live_event(
        "Dedicated Twilio number assigned to business.",
        actor="system",
        severity="info",
        event_type="twilio_number_assigned",
        payload={
            "business_id": business.get("id"),
            "twilio_number": assigned_number,
            "twilio_number_status": next_status,
        },
    )

    return ensure_elevenlabs_phone_number_for_business(updated_business)


def schedule_backend_scenario_execution(event_type: str, payload: Optional[dict] = None):
    global scenario_engine
    if not scenario_engine:
        logging.warning('main.schedule_backend_scenario_execution.event_1760')
        return
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        logging.warning('main.schedule_backend_scenario_execution.event_1710')
        return
    logging.info('main.schedule_backend_scenario_execution.event_1805')
    loop.create_task(scenario_engine.handle_event(event_type, payload or {}))


push_live_event("FastAPI backend active on port 8000.", actor="system", severity="info", event_type="system_startup")


@app.on_event("startup")
async def startup_scenario_engine():
    global scenario_engine
    from .audit import enforced
    from .envelope import writes_enabled, keyring
    enforced()  # Invalid production mode is a startup failure, not a silent bypass.
    if writes_enabled(): keyring()
    if os.getenv('NODEMERE_RECOVERY_MODE', '').lower() in {'1','true','yes','on'}: return
    try:
        if scenario_engine:
            await scenario_engine.start()
            scenario_engine.start_scheduler()
    except Exception as exc:
        logging.error('main.startup_scenario_engine.event_1727')


@app.on_event("shutdown")
async def shutdown_scenario_engine():
    global scenario_engine
    try:
        if scenario_engine:
            await scenario_engine.stop_scheduler()
    except Exception as exc:
        logging.error('main.shutdown_scenario_engine.event_1737')


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
    plan_slug: Optional[str] = None
    billing_cycle: Optional[str] = None

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


SUPPORTED_EMAIL_INTEGRATION_PROVIDERS = {"gmail", "outlook"}
SUPPORTED_INTEGRATION_PROVIDERS = {*SUPPORTED_EMAIL_INTEGRATION_PROVIDERS, "stripe"}
GMAIL_SCOPES = [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
]
GMAIL_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GMAIL_TOKEN_URL = "https://oauth2.googleapis.com/token"
GMAIL_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
GMAIL_MESSAGES_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages"

# --- Outlook / Microsoft Graph Constants ---
OUTLOOK_AUTHORITY = outlook_authority
OUTLOOK_AUTH_URL = f"{OUTLOOK_AUTHORITY}/oauth2/v2.0/authorize"
OUTLOOK_TOKEN_URL = f"{OUTLOOK_AUTHORITY}/oauth2/v2.0/token"
OUTLOOK_REDIRECT_URI = outlook_redirect_uri
OUTLOOK_SCOPES_LIST = [s.strip() for s in outlook_scopes.split(" ") if s.strip()]
GRAPH_BASE_URL = microsoft_graph_base_url
GRAPH_USERINFO_URL = f"{GRAPH_BASE_URL}/me"
GRAPH_MESSAGES_URL = f"{GRAPH_BASE_URL}/me/messages"
GRAPH_SEND_MAIL_URL = f"{GRAPH_BASE_URL}/me/sendMail"
STRIPE_CONNECT_AUTH_URL = "https://connect.stripe.com/oauth/authorize"
STRIPE_CONNECT_SCOPE = "read_write"


class IntegrationAuthorizeResponse(BaseModel):
    provider: str
    authorization_url: str


class IntegrationDisconnectResponse(BaseModel):
    success: bool
    provider: str


class IntegrationEmailSendRequest(BaseModel):
    to: str
    subject: str
    body: str


class IntegrationEmailListItem(BaseModel):
    id: str
    thread_id: Optional[str] = None
    subject: Optional[str] = None
    from_email: Optional[str] = None
    to_email: Optional[str] = None
    snippet: Optional[str] = None
    received_at: Optional[str] = None


class IntegrationEmailMessageResponse(IntegrationEmailListItem):
    body_text: Optional[str] = None


class IntegrationEmailSendResponse(BaseModel):
    id: str
    thread_id: Optional[str] = None
    label_ids: List[str] = Field(default_factory=list)


def _default_user_integration(provider: str, user_id: str) -> dict:
    return {
        "id": str(uuid4()),
        "user_id": user_id,
        "provider": provider,
        "status": "not_connected",
        "selected": False,
        "connected_email": None,
        "scopes": [],
        "provider_metadata": {},
        "credentials": {},
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


def _normalize_user_integration_row(row: dict, user_id: str) -> dict:
    provider = (row or {}).get("provider") or "gmail"
    base = _default_user_integration(provider, user_id)
    base.update(row or {})
    base["scopes"] = base.get("scopes") or []
    base["provider_metadata"] = base.get("provider_metadata") or {}
    base["credentials"] = base.get("credentials") or {}
    base["selected"] = bool(base.get("selected"))
    base["status"] = base.get("status") or "not_connected"
    return base


def _serialize_public_integration(row: dict, user_id: str) -> dict:
    safe_row = dict(_normalize_user_integration_row(row, user_id))
    safe_row.pop("credentials", None)
    return safe_row


CALL_COMPLETED_STATUSES = {"completed", "done", "success"}
CALL_FAILED_STATUSES = {"failed", "error", "canceled"}
CALL_MISSED_STATUSES = {"missed", "no-answer", "no_answer", "busy"}


def _get_google_redirect_uri(request: Optional[Request] = None) -> str:
    if google_oauth_redirect_uri:
        return google_oauth_redirect_uri
    if request is not None:
        return str(request.url_for("gmail_integration_callback"))
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="GOOGLE_OAUTH_REDIRECT_URI is not configured.",
    )


def _get_stripe_redirect_uri(request: Optional[Request] = None) -> str:
    if stripe_connect_redirect_uri:
        return stripe_connect_redirect_uri
    if request is not None:
        return str(request.url_for("stripe_integration_callback"))
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="STRIPE_CONNECT_REDIRECT_URI is not configured.",
    )


def _integration_state_key():
    return hmac.digest(SECRET_KEY.encode(),b'nodemere/oauth-state/v2','sha256').hex()


def _build_integration_state(user_id: str, provider: str, return_to: Optional[str] = None) -> str:
    payload = {
        "sub": user_id,
        "provider": provider,
        "return_to": safe_oauth_return_to(return_to, frontend_base_url),
        "aud": "nodemere-integration-state",
        "nonce": str(uuid4()),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
    }
    tenant = current_tenant.get()
    if not tenant: raise HTTPException(403,'Authenticated Owner context required')
    require_permission(tenant, "integrations")
    payload.update({"actor_id": tenant.actor_id, "business_id": str(tenant.business_id), "aal": tenant.aal})
    return jwt.encode(payload, _integration_state_key(), algorithm=ALGORITHM)


def _decode_integration_state(state_token: str, expected_provider: str) -> dict:
    try:
        payload = jwt.decode(state_token, _integration_state_key(), algorithms=[ALGORITHM], audience="nodemere-integration-state",
                             options={"require_exp": True, "require_sub": True, "require_aud": True})
        if payload.get("provider") != expected_provider or expected_provider not in SUPPORTED_INTEGRATION_PROVIDERS:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported provider state.")
        payload["return_to"] = safe_oauth_return_to(payload.get("return_to"), frontend_base_url)
        if not payload.get('actor_id'): raise HTTPException(400,'Restart the integration connection')
        if payload.get("actor_id"):
            tenant = resolve_tenant(getattr(supabase_admin, "raw", supabase_admin), payload["actor_id"], aal=payload.get("aal","aal1"))
            require_permission(tenant, "integrations")
            if str(tenant.business_id) != payload.get("business_id") or tenant.owner_id != payload.get("sub"):
                raise HTTPException(403, "Integration authority changed")
        return payload
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid integration state.") from exc


def _extract_email_header(headers: List[dict], name: str) -> Optional[str]:
    for header in headers or []:
        if (header.get("name") or "").lower() == name.lower():
            return header.get("value")
    return None


def _decode_gmail_parts(parts: List[dict]) -> str:
    chunks: List[str] = []
    for part in parts or []:
        mime_type = part.get("mimeType") or ""
        body_data = (part.get("body") or {}).get("data")
        if body_data and mime_type.startswith("text/plain"):
            try:
                decoded = base64.urlsafe_b64decode(body_data + "=" * (-len(body_data) % 4)).decode("utf-8", errors="ignore")
                chunks.append(decoded)
            except Exception:
                continue
        nested = part.get("parts") or []
        if nested:
            nested_text = _decode_gmail_parts(nested)
            if nested_text:
                chunks.append(nested_text)
    return "\n".join(chunk for chunk in chunks if chunk).strip()


def _extract_call_direction(row: dict) -> Optional[str]:
    raw_payload = row.get("raw_payload") if isinstance(row.get("raw_payload"), dict) else {}
    conversation_data = row.get("conversation_initiation_data") if isinstance(row.get("conversation_initiation_data"), dict) else {}
    metadata = row.get("conversation_metadata") if isinstance(row.get("conversation_metadata"), dict) else {}
    direction = str(
        first_present(
            row,
            "direction",
        )
        or first_present(
            raw_payload,
            "direction",
            "metadata.direction",
            "metadata.phone_call.direction",
            "conversation_initiation_client_data.dynamic_variables.direction",
            "conversation_initiation_client_data.dynamic_variables.call_direction",
        )
        or first_present(
            conversation_data,
            "dynamic_variables.direction",
            "dynamic_variables.call_direction",
        )
        or first_present(
            metadata,
            "direction",
            "phone_call.direction",
        )
        or ""
    ).strip().lower()
    return direction or None


def _classify_call_status(row: dict) -> str:
    status_value = str(row.get("status") or "").strip().lower()
    outcome_value = str(row.get("outcome") or "").strip().lower()
    success_value = str(row.get("call_successful") or "").strip().lower()
    failure_reason = str(row.get("failure_reason") or "").strip().lower()

    if status_value in CALL_MISSED_STATUSES or outcome_value in CALL_MISSED_STATUSES:
        return "missed"
    if status_value in CALL_FAILED_STATUSES or outcome_value in CALL_FAILED_STATUSES or failure_reason:
        return "failed"
    if success_value in {"true", "yes"}:
        return "completed"
    if status_value in CALL_COMPLETED_STATUSES or outcome_value in CALL_COMPLETED_STATUSES:
        return "completed"
    return "other"


def _empty_receptionist_metrics() -> dict:
    return {
        "total_calls": 0,
        "inbound_calls_count": 0,
        "outbound_calls_count": 0,
        "completed_calls_count": 0,
        "failed_calls_count": 0,
        "missed_calls_count": 0,
        "unknown_direction_calls_count": 0,
        "total_duration_seconds": 0,
        "average_call_duration_seconds": 0,
        "last_call_at": None,
        "success_rate": 0,
    }


def _accumulate_receptionist_metrics(rows: List[dict]) -> dict:
    metrics = _empty_receptionist_metrics()
    durations_with_values = 0

    for row in rows:
        metrics["total_calls"] += 1

        direction = _extract_call_direction(row)
        if direction == "inbound":
            metrics["inbound_calls_count"] += 1
        elif direction in {"outbound", "outgoing"}:
            metrics["outbound_calls_count"] += 1
        else:
            metrics["unknown_direction_calls_count"] += 1

        classification = _classify_call_status(row)
        if classification == "completed":
            metrics["completed_calls_count"] += 1
        elif classification == "failed":
            metrics["failed_calls_count"] += 1
        elif classification == "missed":
            metrics["missed_calls_count"] += 1

        duration_seconds = row.get("duration_seconds")
        if duration_seconds is not None:
            try:
                metrics["total_duration_seconds"] += int(duration_seconds)
                durations_with_values += 1
            except (TypeError, ValueError):
                pass

        created_at_value = row.get("created_at")
        if created_at_value and (metrics["last_call_at"] is None or str(created_at_value) > str(metrics["last_call_at"])):
            metrics["last_call_at"] = created_at_value

    if durations_with_values:
        metrics["average_call_duration_seconds"] = round(
            metrics["total_duration_seconds"] / durations_with_values,
            2,
        )
    if metrics["total_calls"]:
        metrics["success_rate"] = round(
            (metrics["completed_calls_count"] / metrics["total_calls"]) * 100,
            2,
        )
    return metrics


def _fetch_call_log_rows(*, user_id: Optional[str] = None, receptionist_id: Optional[str] = None, limit: int = 5000) -> List[dict]:
    rows: List[dict] = []
    page_size = 1000
    start = 0

    while start < limit:
        end = min(start + page_size - 1, limit - 1)
        query = (
            supabase.table("call_logs")
            .select(
                "id,hired_receptionist_id,receptionist_name,duration_seconds,status,outcome,created_at,call_successful,failure_reason,raw_payload,conversation_initiation_data,conversation_metadata"
            )
            .order("created_at", desc=True)
            .range(start, end)
        )
        if user_id:
            query = query.eq("user_id", str(user_id))
        if receptionist_id:
            query = query.eq("hired_receptionist_id", int_or_none(receptionist_id))

        page_rows = query.execute().data or []
        rows.extend(page_rows)
        if len(page_rows) < page_size:
            break
        start += page_size

    return rows


def refresh_receptionist_call_metrics(receptionist_id: Optional[str]) -> Optional[dict]:
    receptionist_id_value = int_or_none(receptionist_id)
    if receptionist_id_value is None:
        return None

    rows = _fetch_call_log_rows(receptionist_id=str(receptionist_id_value))
    metrics = _accumulate_receptionist_metrics(rows)
    updates = {
        "total_calls": metrics["total_calls"],
        "inbound_calls_count": metrics["inbound_calls_count"],
        "outbound_calls_count": metrics["outbound_calls_count"],
        "completed_calls_count": metrics["completed_calls_count"],
        "failed_calls_count": metrics["failed_calls_count"],
        "missed_calls_count": metrics["missed_calls_count"],
        "average_call_duration_seconds": metrics["average_call_duration_seconds"],
        "last_call_at": metrics["last_call_at"],
    }
    try:
        supabase.table("hired_receptionists").update(updates).eq("id", receptionist_id_value).execute()
    except Exception as exc:
        logging.warning('main.refresh_receptionist_call_metrics.event_2128')
    return metrics


def _parse_gmail_message(message: dict) -> dict:
    payload = message.get("payload") or {}
    headers = payload.get("headers") or []
    internal_ms = message.get("internalDate")
    received_at = None
    if internal_ms:
        try:
            received_at = datetime.fromtimestamp(int(internal_ms) / 1000, tz=timezone.utc).isoformat()
        except Exception:
            received_at = None
    body_text = ""
    body_data = (payload.get("body") or {}).get("data")
    if body_data:
        try:
            body_text = base64.urlsafe_b64decode(body_data + "=" * (-len(body_data) % 4)).decode("utf-8", errors="ignore")
        except Exception:
            body_text = ""
    if not body_text:
        body_text = _decode_gmail_parts(payload.get("parts") or [])
    return {
        "id": message.get("id"),
        "thread_id": message.get("threadId"),
        "subject": _extract_email_header(headers, "Subject"),
        "from_email": _extract_email_header(headers, "From"),
        "to_email": _extract_email_header(headers, "To"),
        "snippet": message.get("snippet"),
        "received_at": received_at,
        "body_text": body_text or None,
    }


def _fetch_integration_row(user_id: str, provider: str) -> Optional[dict]:
    response = (
        supabase_admin.table("integrations")
        .select("*")
        .eq("user_id", user_id)
        .eq("provider", provider)
        .limit(1)
        .execute()
    )
    if response.data:
        return _normalize_user_integration_row(response.data[0], user_id)
    return None


def _upsert_integration_row(user_id: str, provider: str, updates: dict) -> dict:
    existing_row = _fetch_integration_row(user_id, provider)
    base_row = _normalize_user_integration_row(existing_row or {"provider": provider}, user_id)
    merged = {
        **base_row,
        **updates,
        "provider": provider,
        "user_id": user_id,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if "credentials" not in merged or merged["credentials"] is None:
        merged["credentials"] = {}
    if "provider_metadata" not in merged or merged["provider_metadata"] is None:
        merged["provider_metadata"] = {}
    if "scopes" not in merged or merged["scopes"] is None:
        merged["scopes"] = []

    try:
        if existing_row:
            response = (
                supabase_admin.table("integrations")
                .update({
                    "status": merged["status"],
                    "selected": merged["selected"],
                    "connected_email": merged["connected_email"],
                    "scopes": merged["scopes"],
                    "provider_metadata": merged["provider_metadata"],
                    "credentials": merged["credentials"],
                    "updated_at": merged["updated_at"],
                })
                .eq("id", existing_row["id"])
                .execute()
            )
        else:
            response = supabase_admin.table("integrations").insert(merged).execute()
    except APIError as exc:
        raw_error = getattr(exc, "args", [None])[0]
        if isinstance(raw_error, dict):
            error_message = str(raw_error.get("message") or exc)
        else:
            error_message = str(raw_error or exc)
        if "integrations_provider_check" in error_message and provider == "stripe":
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database migration missing: run `sql/add_stripe_integration_provider.sql` in Supabase before using Stripe integrations.",
            ) from exc
        raise

    if not response.data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to save integration.")
    return _normalize_user_integration_row(response.data[0], user_id)


def _stripe_platform_api_key(livemode: Optional[bool] = None) -> str:
    is_payment_test_mode()
    use_live_key = (not (PAYMENT_TEST_MODE or is_real_stripe_test_mode())) if livemode is None else livemode
    api_key = STRIPE_LIVE_SECRET_KEY if use_live_key else STRIPE_TEST_SECRET_KEY
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='The request could not be completed',
        )
    return api_key


def _stripe_object_to_dict(value) -> dict:
    if hasattr(value, "to_dict_recursive"):
        return value.to_dict_recursive()
    return dict(value or {})


def _exchange_stripe_code(code: str) -> dict:
    if is_payment_test_mode():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Stripe account authorization is simulated while payment test mode is enabled.")
    if not _stripe_connect_client_id():
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Stripe Connect is not configured.",
        )
    try:
        token = stripe.OAuth.token(
            api_key=_stripe_platform_api_key(),
            grant_type="authorization_code",
            code=code,
        )
        return _stripe_object_to_dict(token)
    except Exception as exc:
        logging.error('main._exchange_stripe_code.event_2264')
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Stripe account authorization failed.",
        ) from exc


def _get_connected_stripe_request_options(user_id: str) -> dict:
    integration = _fetch_integration_row(user_id, "stripe")
    credentials = (integration or {}).get("credentials") or {}
    stripe_user_id = credentials.get("stripe_user_id")
    livemode = credentials.get("livemode")
    if not integration or integration.get("status") != "connected" or not stripe_user_id or not isinstance(livemode, bool):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Stripe is not connected. Connect Stripe in Integrations before running payment actions.",
        )
    return {
        "api_key": _stripe_platform_api_key(bool(livemode)),
        "stripe_account": stripe_user_id,
    }


def _deauthorize_stripe_integration(integration: Optional[dict]) -> None:
    if is_payment_test_mode():
        return
    credentials = (integration or {}).get("credentials") or {}
    stripe_user_id = credentials.get("stripe_user_id")
    if not stripe_user_id or not _stripe_connect_client_id():
        return
    try:
        stripe.OAuth.deauthorize(
            api_key=_stripe_platform_api_key(credentials.get("livemode")),
            client_id=_stripe_connect_client_id(),
            stripe_user_id=stripe_user_id,
        )
    except Exception as exc:
        logging.warning('main._deauthorize_stripe_integration.event_2301')


def _exchange_google_code(code: str, redirect_uri: str) -> dict:
    if not google_client_id or not google_client_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google OAuth is not configured.",
        )
    token_response = requests.post(
        GMAIL_TOKEN_URL,
        data={
            "code": code,
            "client_id": google_client_id,
            "client_secret": google_client_secret,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        },
        timeout=30,
    )
    if not token_response.ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google token exchange failed.")
    return token_response.json()


def _refresh_google_credentials(credentials: dict) -> dict:
    refresh_token = (credentials or {}).get("refresh_token")
    if not refresh_token or not google_client_id or not google_client_secret:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google refresh token is missing.")
    token_response = requests.post(
        GMAIL_TOKEN_URL,
        data={
            "client_id": google_client_id,
            "client_secret": google_client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        },
        timeout=30,
    )
    if not token_response.ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google token refresh failed.")
    refreshed = token_response.json()
    next_credentials = dict(credentials or {})
    next_credentials["access_token"] = refreshed.get("access_token")
    next_credentials["token_type"] = refreshed.get("token_type", "Bearer")
    expires_in = refreshed.get("expires_in") or 3600
    next_credentials["expires_at"] = (
        datetime.now(timezone.utc) + timedelta(seconds=int(expires_in) - 60)
    ).isoformat()
    return next_credentials


def _get_valid_gmail_integration(user_id: str) -> dict:
    integration = _fetch_integration_row(user_id, "gmail")
    if not integration:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gmail is not connected.")
    credentials = integration.get("credentials") or {}
    access_token = credentials.get("access_token")
    expires_at = credentials.get("expires_at")
    is_expired = True
    if access_token and expires_at:
        try:
            is_expired = datetime.fromisoformat(expires_at) <= datetime.now(timezone.utc)
        except Exception:
            is_expired = True
    if not access_token or is_expired:
        credentials = _refresh_google_credentials(credentials)
        integration = _upsert_integration_row(
            user_id,
            "gmail",
            {
                "credentials": credentials,
                "status": "connected",
                "selected": True,
            },
        )
    return integration


def _gmail_api_request(user_id: str, method: str, url: str, **kwargs) -> requests.Response:
    integration = _get_valid_gmail_integration(user_id)
    credentials = integration.get("credentials") or {}
    access_token = credentials.get("access_token")
    if not access_token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Gmail access token is missing.")
    headers = kwargs.pop("headers", {})
    headers["Authorization"] = f"Bearer {access_token}"
    response = requests.request(method, url, headers=headers, timeout=30, **kwargs)
    if response.status_code == 401:
        refreshed = _refresh_google_credentials(credentials)
        integration = _upsert_integration_row(
            user_id,
            "gmail",
            {
                "credentials": refreshed,
                "status": "connected",
                "selected": True,
            },
        )
        headers["Authorization"] = f"Bearer {(integration.get('credentials') or {}).get('access_token')}"
        response = requests.request(method, url, headers=headers, timeout=30, **kwargs)
    return response


def _send_gmail_email_for_user(user_id: str, to: str, subject: str, body: str) -> dict:
    integration = _get_valid_gmail_integration(user_id)
    connected_email = integration.get("connected_email")
    raw_message = (
        f"From: {connected_email}\r\n"
        f"To: {to}\r\n"
        f"Subject: {subject}\r\n"
        "Content-Type: text/plain; charset=utf-8\r\n\r\n"
        f"{body}"
    )
    encoded_message = base64.urlsafe_b64encode(raw_message.encode("utf-8")).decode("utf-8")
    response = _gmail_api_request(
        user_id,
        "POST",
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        headers={"Content-Type": "application/json"},
        json={"raw": encoded_message},
    )
    if not response.ok:
        logging.error('main._send_gmail_email_for_user.event_2479')
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to send message.")
    return response.json()


# =============================================================================
# Outlook / Microsoft Graph Integration Helpers
# =============================================================================


def _get_outlook_redirect_uri(request: Optional[Request] = None) -> str:
    if OUTLOOK_REDIRECT_URI:
        return OUTLOOK_REDIRECT_URI
    if request is not None:
        return str(request.url_for("outlook_integration_callback"))
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="OUTLOOK_REDIRECT_URI is not configured.",
    )


def _exchange_outlook_code(code: str, redirect_uri: str) -> dict:
    if not outlook_client_id or not outlook_client_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Outlook OAuth is not configured.",
        )
    token_response = requests.post(
        OUTLOOK_TOKEN_URL,
        data={
            "client_id": outlook_client_id,
            "client_secret": outlook_client_secret,
            "code": code,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
            "scope": outlook_scopes,
        },
        timeout=30,
    )
    if not token_response.ok:
        logging.error('main._exchange_outlook_code.event_2519')
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Outlook token exchange failed.")
    return token_response.json()


def _refresh_outlook_credentials(credentials: dict) -> dict:
    refresh_token = (credentials or {}).get("refresh_token")
    if not refresh_token or not outlook_client_id or not outlook_client_secret:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Outlook refresh token is missing.")
    token_response = requests.post(
        OUTLOOK_TOKEN_URL,
        data={
            "client_id": outlook_client_id,
            "client_secret": outlook_client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
            "scope": outlook_scopes,
        },
        timeout=30,
    )
    if not token_response.ok:
        logging.error('main._refresh_outlook_credentials.event_2540')
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Outlook token refresh failed.")
    refreshed = token_response.json()
    next_credentials = dict(credentials or {})
    next_credentials["access_token"] = refreshed.get("access_token")
    next_credentials["token_type"] = refreshed.get("token_type", "Bearer")
    expires_in = refreshed.get("expires_in") or 3600
    next_credentials["expires_at"] = (
        datetime.now(timezone.utc) + timedelta(seconds=int(expires_in) - 60)
    ).isoformat()
    return next_credentials


def _get_valid_outlook_integration(user_id: str) -> dict:
    integration = _fetch_integration_row(user_id, "outlook")
    if not integration:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Outlook is not connected.")
    credentials = integration.get("credentials") or {}
    access_token = credentials.get("access_token")
    expires_at = credentials.get("expires_at")
    is_expired = True
    if access_token and expires_at:
        try:
            is_expired = datetime.fromisoformat(expires_at) <= datetime.now(timezone.utc)
        except Exception:
            is_expired = True
    if not access_token or is_expired:
        credentials = _refresh_outlook_credentials(credentials)
        integration = _upsert_integration_row(
            user_id,
            "outlook",
            {
                "credentials": credentials,
                "status": "connected",
                "selected": True,
            },
        )
    return integration


def _outlook_api_request(user_id: str, method: str, url: str, **kwargs) -> requests.Response:
    integration = _get_valid_outlook_integration(user_id)
    credentials = integration.get("credentials") or {}
    access_token = credentials.get("access_token")
    if not access_token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Outlook access token is missing.")
    headers = kwargs.pop("headers", {})
    headers["Authorization"] = f"Bearer {access_token}"
    response = requests.request(method, url, headers=headers, timeout=30, **kwargs)
    if response.status_code == 401:
        refreshed = _refresh_outlook_credentials(credentials)
        integration = _upsert_integration_row(
            user_id,
            "outlook",
            {
                "credentials": refreshed,
                "status": "connected",
                "selected": True,
            },
        )
        headers["Authorization"] = f"Bearer {(integration.get('credentials') or {}).get('access_token')}"
        response = requests.request(method, url, headers=headers, timeout=30, **kwargs)
    return response


def _parse_outlook_message(message: dict) -> dict:
    return {
        "id": message.get("id"),
        "thread_id": message.get("conversationId") or message.get("threadId"),
        "subject": message.get("subject"),
        "from_email": (message.get("from") or {}).get("emailAddress", {}).get("address") if message.get("from") else None,
        "to_email": ", ".join(
            r.get("emailAddress", {}).get("address", "")
            for r in (message.get("toRecipients") or [])
            if r.get("emailAddress", {}).get("address")
        ) or None,
        "snippet": message.get("bodyPreview") or message.get("snippet"),
        "received_at": message.get("receivedDateTime"),
        "body_text": (message.get("body") or {}).get("content") if (message.get("body") or {}).get("contentType") == "text" else None,
    }


def _send_outlook_email_for_user(user_id: str, to: str, subject: str, body: str) -> dict:
    integration = _get_valid_outlook_integration(user_id)
    connected_email = integration.get("connected_email")
    payload = {
        "message": {
            "subject": subject,
            "body": {
                "contentType": "Text",
                "content": body,
            },
            "toRecipients": [
                {"emailAddress": {"address": to}}
            ],
        },
        "saveToSentItems": True,
    }
    response = _outlook_api_request(
        user_id,
        "POST",
        GRAPH_SEND_MAIL_URL,
        headers={"Content-Type": "application/json"},
        json=payload,
    )
    if not response.ok:
        logging.error('main._send_outlook_email_for_user.event_2646')
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to send message via Outlook.")
    return {"id": "sent", "status": "sent", "provider": "outlook"}


def _send_email_for_user(user_id: str, to: str, subject: str, body: str, provider: Optional[str] = None) -> dict:
    """Route email sending through the connected integration provider."""
    if not provider:
        integration = _fetch_integration_row(user_id, "outlook")
        if integration and integration.get("status") == "connected":
            provider = "outlook"
        else:
            provider = "gmail"

    if provider == "outlook":
        return _send_outlook_email_for_user(user_id, to, subject, body)
    return _send_gmail_email_for_user(user_id, to, subject, body)


class RuntimeModeRequest(BaseModel):
    mode: str

class StageRequest(BaseModel):
    stage: str

class AgentCallTypesRequest(BaseModel):
    call_types: Optional[str] = None
    direction: Optional[str] = None
    call_routing: Optional[str] = None
    calls: Optional[str] = None

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
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None

class OnboardingRequest(BaseModel):
    business_name: Optional[str] = None
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
    policies: Optional[str] = None
    faq: Optional[str] = None
    terms_of_service: Optional[dict] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    services: Optional[list[dict]] = None
    mark_onboarded: bool = False

class BusinessForwardingUpdateRequest(BaseModel):
    agent_id: Optional[str] = None
    entry_id: Optional[str] = None
    source_number: str
    source_label: Optional[str] = None
    provider: str
    provider_label: Optional[str] = None
    status: Optional[Literal["draft", "pending_test", "verified"]] = "draft"
    confirmed_enabled: Optional[bool] = False
    verified: Optional[bool] = False


class BusinessForwardingNumberSearchRequest(BaseModel):
    area_code: Optional[str] = None
    contains: Optional[str] = None
    near_number: Optional[str] = None
    region: Optional[str] = None
    limit: Optional[int] = 100


class BusinessForwardingNumberClaimRequest(BaseModel):
    phone_number: str
    label: Optional[str] = None


class BusinessCallerIdVerificationStartRequest(BaseModel):
    entry_id: Optional[str] = None
    source_number: Optional[str] = None
    source_label: Optional[str] = None
    extension: Optional[str] = None

class ScenarioTriggerRequest(BaseModel):
    trigger_key: str
    payload: Optional[dict] = None
    created_at: Optional[datetime] = None

class LegalAcceptanceRequest(BaseModel):
    version: str
    accepted_terms: bool
    certified_permitted_use: bool


class AccountDeletionRequest(BaseModel):
    business_name: str = Field(min_length=1, max_length=200)
    reason: str = Field(min_length=1, max_length=120)
    feedback: Optional[str] = Field(default=None, max_length=2000)
    acknowledged: bool = False

class CustomerCreateRequest(BaseModel):
    person_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None

class CustomerUpdateRequest(BaseModel):
    customer_id: Optional[str] = None
    person_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None

class PaymentLinkCreateRequest(BaseModel):
    amount: int
    currency: str = "usd"
    description: Optional[str] = None
    person_id: Optional[str] = None
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None

class InvoiceCreateRequest(BaseModel):
    amount: int
    currency: str = "usd"
    description: Optional[str] = None
    person_id: Optional[str] = None
    customer_id: Optional[str] = None
    appointment_id: Optional[str] = None
    service_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    due_days: Optional[int] = 7

class InvoiceSendRequest(BaseModel):
    invoice_id: str

class RefundPaymentRequest(BaseModel):
    payment_id: str
    amount: Optional[int] = None
    refund_reason: Optional[str] = None

class CancelSubscriptionRequest(BaseModel):
    subscription_id: Optional[str] = None
    customer_id: Optional[str] = None
    person_id: Optional[str] = None


class ScenarioSendEmailRequest(BaseModel):
    to: str
    subject: str
    body: str
    provider: Optional[str] = None

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
    "intent_appointment_rescheduled": "appointment_rescheduled",
    "intent_appointment_confirmed": "appointment_confirmed",
    "intent_appointment_completed": "appointment_completed",
    "intent_appointment_missed": "appointment_missed",
    "appointment_create": "appointment_created",
    "appointment_update": "appointment_updated",
    "appointment_cancel": "appointment_cancelled",
    "appointment_reschedule": "appointment_rescheduled",
    "appointment_confirm": "appointment_confirmed",
    "appointment_complete": "appointment_completed",
    "appointment_mark_missed": "appointment_missed",
    "create_appointment": "appointment_created",
    "update_appointment": "appointment_updated",
    "cancel_appointment": "appointment_cancelled",
    "reschedule_appointment": "appointment_rescheduled",
    "confirm_appointment": "appointment_confirmed",
    "complete_appointment": "appointment_completed",
    "miss_appointment": "appointment_missed",
    "intent_record_created": "record_created",
    "intent_record_updated": "record_updated",
    "create_record": "record_created",
    "update_record": "record_updated",
    "intent_payment_received": "payment_received",
    "intent_refund_issued": "refund_issued",
    "intent_subscription_created": "subscription_created",
    "create_customer": "create_customer",
    "update_customer": "update_customer",
    "create_payment": "create_payment",
    "send_payment_link": "send_payment_link",
    "create_invoice": "create_invoice",
    "send_invoice": "send_invoice",
    "refund_payment": "refund_issued",
    "cancel_subscription": "cancel_subscription",
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
    "appointment_created",
    "appointment_updated",
    "appointment_cancelled",
    "appointment_rescheduled",
    "appointment_confirmed",
    "appointment_completed",
    "appointment_missed",
    "create_appointment",
    "update_appointment",
    "cancel_appointment",
    "record_created",
    "record_updated",
    "payment_received",
    "refund_issued",
    "subscription_created",
    "create_customer",
    "update_customer",
    "create_payment",
    "send_payment_link",
    "create_invoice",
    "send_invoice",
    "refund_payment",
    "cancel_subscription",
    "send_email",
    "add_tag",
    "search_tags",
    "update_tag",
    "delete_tag",
    "neutral",
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
    logging.error('main.validation_exception_handler.event_3002')
    return JSONResponse(status_code=422, content={"detail": "Invalid request data"})


@app.exception_handler(Exception)
async def private_error_handler(request: Request, exc: Exception):
    logging.error('main.private_error_handler.event_1')
    return JSONResponse(status_code=500, content={"detail":"The request could not be completed"},
        headers={"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"})

# --- CORS Configuration ---
configured_origins = [
    origin.strip()
    for origin in os.environ.get("CORS_ORIGINS", "").split(",")
    if origin.strip()
]
origins = configured_origins or [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "https://nodemere.ai",
    "https://www.nodemere.ai",
    "https://nodemere.io",
    "https://www.nodemere.io",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    request_id = getattr(request.state, 'audit_event', {}).get('request_id') or uuid4().hex
    correlation_token = correlation_id.set(request_id)
    try:
        response = await call_next(request)
    finally:
        correlation_id.reset(correlation_token)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("Cache-Control", "private, no-store")
    response.headers.setdefault("X-Request-ID", request_id)
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    return response


def is_public_api_route(request: Request) -> bool:
    path = request.url.path
    # These bootstrap endpoints still require get_current_user themselves, but
    # must be reachable before membership/MFA enrollment has completed.
    if path in {"/api/workforce/session", "/api/workforce/invitations/pending"} or (path.startswith("/api/workforce/invitations/") and path.endswith("/accept")):
        return True
    if request.method == "OPTIONS":
        return True
    if path == "/api/sonar/pricing/plans":
        return True
    if path == "/api/public/project-intelligence" and request.method == "GET":
        return True
    if path == "/api/sonar/payments/test-mode" and request.method == "GET":
        return True
    if path.startswith("/api/contracts/"):
        return True
    if path.startswith("/api/upload/") or path.startswith("/api/verification/"):
        return True
    # These routes use provider signatures or the dedicated internal-tool secret
    # at the endpoint. They cannot use a browser user JWT.
    if path.startswith("/api/webhooks/elevenlabs/") or path.startswith("/api/tools/"):
        return True
    if path in {"/api/call/route", "/api/scenarios/resume"}:
        return True
    return False


async def require_internal_tool_authorization(request: Request):
    # Billing/provider simulation must never change this authentication boundary.
    if not internal_tool_secret:
        logging.error('main.require_internal_tool_authorization.event_3027')
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Internal tool authentication is not configured.",
        )
    supplied = request.headers.get("x-nodemere-internal-secret") or ""
    if not hmac.compare_digest(supplied.encode("utf-8"), internal_tool_secret.encode("utf-8")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid internal tool authorization.")
    token = request.headers.get("x-nodemere-context")
    scoped_path = request.scope.get("path", "")
    if (scoped_path.startswith(("/api/tools/", "/api/call/")) or scoped_path == "/api/scenarios/resume") and not token:
        raise HTTPException(400, "A signed internal-tool business context is required")
    if token:
        claims = verify_internal_context(internal_tool_secret, token)
        business = load_business_by_id(claims.get("business_id"))
        if not business or str(business["user_id"]) != claims["sub"]:
            raise HTTPException(403, "Tool business unavailable")
        from .authorization import account_active
        if not account_active(getattr(supabase_admin,'raw',supabase_admin),claims['sub']):
            raise HTTPException(403,'Tool business account is unavailable')
        current_tenant.set(Tenant(claims["sub"], business["id"], claims["sub"], service=True))


@app.middleware("http")
async def require_authenticated_api_request(request: Request, call_next):
    if os.getenv('NODEMERE_RECOVERY_MODE', '').lower() in {'1','true','yes','on'}:
        return JSONResponse(status_code=503, content={"detail":"Isolated recovery mode; application traffic is disabled"})
    path = request.url.path
    # Retained source from the previous product is not an alternate Nodemere
    # API. Keep it inert rather than exposing its old authorization model.
    retired={'messages','breakroom','reps','money-table','leads','purchases','ai-agents','campaigns','prizes','passwords','lead-campaigns','oauth','helpdesk','track-visitor'}
    if path.strip('/').split('/')[0] in retired:
        return JSONResponse(status_code=410,content={"detail":"This legacy endpoint is retired"})
    onboarding=path == '/users/me/onboarding'
    protected = onboarding or path.startswith(("/api/", "/businesses/", "/users/me/integrations")) or path == "/create-checkout-session"
    if not protected or is_public_api_route(request) or path.endswith("/callback"):
        return await call_next(request)

    authorization = request.headers.get("authorization") or ""
    if not authorization.lower().startswith("bearer "):
        return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"detail": "Authentication required."})
    access_token = authorization.split(" ", 1)[1].strip()
    if not access_token:
        return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"detail": "Authentication required."})
    tenant = None
    try:
        user = await get_current_user(SimpleNamespace(credentials=access_token))
        request.state.authenticated_user_id = str(user.id)
        raw_db=getattr(supabase_admin, "raw", supabase_admin)
        tenant = resolve_tenant(raw_db, str(user.id), aal=getattr(user,"nodemere_aal","aal1"),allow_missing=onboarding)
        if onboarding and tenant is None:
            if raw_db.table('businesses').select('id').eq('user_id',str(user.id)).limit(1).execute().data:
                raise HTTPException(403,'Active business membership required')
        elif onboarding:
            profile=raw_db.table('users').select('onboarded').eq('id',str(user.id)).limit(1).execute().data or [{}]
            if tenant.role != 'OWNER': raise HTTPException(403,'Owner required for business setup')
            if profile[0].get('onboarded') or tenant.mfa_required or getattr(user,'nodemere_mfa_enrolled',False):
                require_permission(tenant,'administration')
        if tenant and getattr(user,"nodemere_mfa_enrolled",False):
            tenant = replace(tenant,mfa_required=True)
        if not onboarding: require_permission(tenant, route_permission(path, request.method))
        if tenant: begin_audit_request(request, supabase_admin, tenant)
    except HTTPException as exc:
        from .audit import denied_request
        try: denied_request(request, supabase_admin, exc.status_code, tenant)
        except HTTPException:
            return JSONResponse(status_code=503, content={"detail":"Security audit service is unavailable"})
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
    except Exception:
        return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, content={"detail": "Business authorization is temporarily unavailable."})
    identity_token = current_identity.set(user)
    tenant_token = current_tenant.set(tenant)
    from .audit import request_context
    audit_token = request_context.set(getattr(request.state, 'audit_event', {}).get('request_id'))
    try:
        if request.method in {"POST", "PUT", "PATCH", "DELETE"} and "application/json" in request.headers.get("content-type", ""):
            try:
                body = await request.json()
                if tenant: validate_references(raw_db, tenant, body)
                from .permissions import contains_privileged_scenario_action
                if "/scenarios" in path and contains_privileged_scenario_action(body):
                    require_permission(tenant, "billing.change")
            except HTTPException as exc:
                from .audit import denied_request
                denied_request(request, supabase_admin, exc.status_code, tenant)
                return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
            except (ValueError, TypeError):
                return JSONResponse(status_code=400, content={"detail": "Invalid JSON request"})
        response = await call_next(request)
        return await finish_audit_request(request, response, supabase_admin)
    except HTTPException as exc:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
    finally:
        request_context.reset(audit_token)
        current_tenant.reset(tenant_token)
        current_identity.reset(identity_token)


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
                getattr(request.scope.get('route'),'path','/unmatched'),
                status.HTTP_500_INTERNAL_SERVER_ERROR,
                duration_ms,
                infer_route_source(request),
                getattr(request.state, "authenticated_user_id", None),
            )
        raise

    if should_track:
        duration_ms = int((time.perf_counter() - started_at) * 1000)
        push_route_hit(
            request.method,
            getattr(request.scope.get('route'),'path','/unmatched'),
            response.status_code,
            duration_ms,
            infer_route_source(request),
            getattr(request.state, "authenticated_user_id", None),
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
    logging.debug('main.track_visitor.event_3180')

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
                        logging.debug('main.track_visitor.event_3089')
                    else:
                        logging.warning('main.track_visitor.event_3091')
                else:
                    logging.warning('main.track_visitor.event_3099')
        except httpx.RequestError as e:
            logging.error('main.track_visitor.event_3101')
        except Exception as e:
            logging.error('main.track_visitor.event_3103')
    else:
        logging.debug('main.track_visitor.event_3160')
    
    if not user_agent:
        logging.warning('main.track_visitor.event_3163')
        return {"message": "User agent is required for tracking.", "status": "skipped"}

    try:
        # Check if visitor with this user_agent already exists, select 'visits' as well
        response = supabase.table('visitors').select('id', 'visits').eq('user_agent', user_agent).execute()

        if response.data:
            # Visitor exists, update last_visited and increment visits
            existing_visitor = response.data[0]
            current_visits = existing_visitor.get('visits', 0)
            logging.debug('main.track_visitor.event_3119')
            
            update_data = {
                "visits": current_visits + 1,
                "last_visited": datetime.now(timezone.utc).isoformat(),
                "iplocation": iplocation # Ensure iplocation is updated for returning visitors
            }
            logging.debug('main.track_visitor.event_3126')
            update_response = supabase.table('visitors').update(update_data).eq('user_agent', user_agent).execute()

            if update_response.data:
                logging.info('main.track_visitor.event_3130')
                return {"message": "Returning visitor updated."}
            else:
                logging.error('main.track_visitor.event_3133')
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
                logging.info('main.track_visitor.event_3147')
                return {"message": "Visitor tracked successfully."}
            else:
                logging.error('main.track_visitor.event_3150')
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to track visitor.")
    except Exception as e:
        logging.error('main.track_visitor.event_3153')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='The request could not be completed')


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
    logging.info('main.set_payment_test_mode.event_3271')

def get_payment_mode_label() -> str:
    return "test" if PAYMENT_TEST_MODE or is_real_stripe_test_mode() else "live"

def get_payment_frontend_base_url() -> str:
    if is_payment_test_mode() or is_real_stripe_test_mode():
        return os.environ.get("PAYMENT_TEST_FRONTEND_URL", "http://localhost:5173")
    return os.environ.get("PAYMENT_LIVE_FRONTEND_URL", "https://nodemere.com")


def _simulated_id(kind: str) -> str:
    return f"sim_{kind}_{uuid4().hex}"


def _simulated_customer_for_user(
    user_id: str,
    *,
    customer_id: Optional[str] = None,
    person_id: Optional[str] = None,
    name: Optional[str] = None,
    email: Optional[str] = None,
    phone: Optional[str] = None,
) -> dict:
    """Return a local Stripe-shaped customer without contacting Stripe."""
    customer_id = customer_id if str(customer_id or "").startswith("sim_cus_") else _simulated_id("cus")
    metadata = {"user_id": str(user_id), "simulation": "true"}
    if person_id:
        metadata["person_id"] = str(person_id)
        persist_person_stripe_customer_id(user_id, person_id, customer_id)
    return {
        "id": customer_id,
        "object": "customer",
        "name": name,
        "email": email,
        "phone": phone,
        "metadata": metadata,
        "created": int(datetime.now(timezone.utc).timestamp()),
        "simulation": True,
    }


def _resolve_checkout_plan(request: CreateCheckoutSessionRequest, test_mode: bool) -> tuple[str, str]:
    requested_plan = str(request.plan_slug or "").strip().lower()
    if requested_plan:
        if requested_plan not in DEFAULT_PLAN_ENTITLEMENTS or requested_plan == "free":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The selected plan is not a paid Nodemere plan.")
        billing_cycle = str(request.billing_cycle or "monthly").strip().lower()
        if billing_cycle not in {"monthly", "annually", "annual", "yearly"}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The selected billing cycle is not supported.")
        return requested_plan, "yearly" if billing_cycle in {"annually", "annual", "yearly"} else "monthly"

    # Older clients may only send the Stripe price ID. Read from the selected
    # mode's catalog, but never create or charge anything in this fallback.
    try:
        requested_price = stripe.Price.retrieve(request.price_id)
        requested_product = stripe.Product.retrieve(requested_price.get("product"))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The selected Stripe price is not available.") from exc
    plan_slug = str(requested_product.get("name") or "").strip().lower()
    if plan_slug not in DEFAULT_PLAN_ENTITLEMENTS or plan_slug == "free":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The selected Stripe price is not a paid Nodemere plan.")
    interval = ((requested_price.get("recurring") or {}).get("interval") or "month").lower()
    return plan_slug, "yearly" if interval == "year" else "monthly"


def _apply_simulated_subscription(user_id: str, plan_slug: str, billing_cycle: str, customer_id: str) -> dict:
    now = datetime.now(timezone.utc)
    period_days = 365 if billing_cycle == "yearly" else 30
    period_end = now + timedelta(days=period_days)
    subscription_id = _simulated_id("sub")
    update_data = {
        "stripe_customer_id": customer_id,
        "stripe_subscription_id": subscription_id,
        "plan": plan_slug,
        "subscription_status": "active",
        "billing_period": billing_cycle,
        "trial_start_date": None,
        "trial_end_date": None,
        "started_trial": False,
        "source": "simulation",
    }
    supabase_admin.table("users").update(update_data).eq("id", str(user_id)).execute()
    sync_business_plan_entitlement(
        str(user_id),
        plan_slug,
        now.isoformat(),
        period_end.isoformat(),
        reset_usage=True,
    )
    return {
        "id": subscription_id,
        "object": "subscription",
        "customer": customer_id,
        "status": "active",
        "cancel_at_period_end": False,
        "current_period_start": int(now.timestamp()),
        "current_period_end": int(period_end.timestamp()),
        "metadata": {"supabase_user_id": str(user_id), "simulation": "true", "plan": plan_slug},
        "simulation": True,
    }

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
                detail='The request could not be completed',
            )

def build_invoice_metadata(*, person_id: Optional[str] = None, appointment_id: Optional[str] = None, service_id: Optional[str] = None):
    metadata = {"source": "nodemere_scenarios"}
    if person_id:
        metadata["person_id"] = str(person_id)
    if appointment_id:
        metadata["appointment_id"] = str(appointment_id)
    if service_id:
        metadata["service_id"] = str(service_id)
    return metadata

def serialize_stripe_customer(customer):
    if not customer:
        return {}
    return {
        "id": customer.get("id"),
        "customer_id": customer.get("id"),
        "object": customer.get("object"),
        "name": customer.get("name"),
        "email": customer.get("email"),
        "phone": customer.get("phone"),
        "metadata": customer.get("metadata"),
        "created": customer.get("created"),
        "status": "created",
    }

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

def serialize_stripe_subscription(subscription):
    if not subscription:
        return {}
    return {
        "id": subscription.get("id"),
        "subscription_id": subscription.get("id"),
        "object": subscription.get("object"),
        "customer_id": subscription.get("customer"),
        "status": subscription.get("status"),
        "cancel_at_period_end": subscription.get("cancel_at_period_end"),
        "canceled_at": subscription.get("canceled_at"),
        "current_period_end": subscription.get("current_period_end"),
        "metadata": subscription.get("metadata"),
        "created": subscription.get("created"),
    }

def serialize_stripe_refund(refund):
    if not refund:
        return {}
    return {
        "id": refund.get("id"),
        "refund_id": refund.get("id"),
        "object": refund.get("object"),
        "payment_intent": refund.get("payment_intent"),
        "charge": refund.get("charge"),
        "amount": refund.get("amount"),
        "currency": refund.get("currency"),
        "reason": refund.get("reason"),
        "status": refund.get("status"),
        "created": refund.get("created"),
        "metadata": refund.get("metadata"),
    }

def load_person_by_id_for_user(user_id: str, person_id: Optional[str]) -> Optional[dict]:
    if not user_id or not person_id:
        return None
    try:
        response = (
            supabase.table("people")
            .select("*")
            .eq("id", str(person_id))
            .eq("user_id", str(user_id))
            .limit(1)
            .execute()
        )
        return response.data[0] if response.data else None
    except Exception as exc:
        logging.warning('main.load_person_by_id_for_user.event_3383')
        return None

def persist_person_stripe_customer_id(user_id: str, person_id: Optional[str], customer_id: Optional[str]) -> None:
    if not user_id or not person_id or not customer_id:
        return
    try:
        supabase.table("people").update({
            "stripe_customer_id": customer_id,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", str(person_id)).eq("user_id", str(user_id)).execute()
    except Exception as exc:
        logging.debug('main.persist_person_stripe_customer_id.event_3395')

def resolve_connected_account_user_id(stripe_account_id: Optional[str]) -> Optional[str]:
    if not stripe_account_id:
        return None
    try:
        rows = supabase.table("integrations").select("user_id,provider_metadata,credentials").eq("provider", "stripe").execute().data or []
        for row in rows:
            credentials = row.get("credentials") or {}
            account_id = credentials.get("stripe_user_id")
            if str(account_id or "").strip() == str(stripe_account_id).strip():
                return row.get("user_id")
    except Exception as exc:
        logging.warning('main.resolve_connected_account_user_id.event_3408')
    return None

def build_scenario_customer_metadata(*, user_id: str, person_id: Optional[str] = None, appointment_id: Optional[str] = None, service_id: Optional[str] = None) -> dict:
    metadata = build_invoice_metadata(person_id=person_id, appointment_id=appointment_id, service_id=service_id)
    metadata["user_id"] = str(user_id)
    return metadata


def calculate_platform_application_fee(amount_cents: int) -> int:
    """Calculate the platform fee in cents without ever exceeding the charge."""
    try:
        percent = Decimal(str(stripe_application_fee_percent or "0"))
    except (InvalidOperation, TypeError, ValueError):
        percent = Decimal("0")
    amount = max(int(amount_cents or 0), 0)
    if amount == 0 or percent <= 0:
        return 0
    fee = (Decimal(amount) * percent / Decimal("100")).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    return min(amount, max(int(fee), 0))

def create_or_update_stripe_customer_for_user(
    *,
    user_id: str,
    customer_id: Optional[str] = None,
    person_id: Optional[str] = None,
    customer_name: Optional[str] = None,
    customer_email: Optional[str] = None,
    customer_phone: Optional[str] = None,
    create_if_missing: bool = True,
    appointment_id: Optional[str] = None,
    service_id: Optional[str] = None,
):
    if is_payment_test_mode():
        person = load_person_by_id_for_user(user_id, person_id)
        profile_response = (
            supabase_admin.table("users")
            .select("email")
            .eq("id", str(user_id))
            .limit(1)
            .execute()
        )
        profile = (profile_response.data or [None])[0] or {}
        return _simulated_customer_for_user(
            user_id,
            customer_id=customer_id,
            person_id=person_id,
            name=customer_name or (format_person_display_name(person) if person else None),
            email=customer_email or (
                person.get("email") if person and person.get("email") else profile.get("email")
            ),
            phone=customer_phone or (person.get("phone") if person else None),
        ), person

    stripe_request_options = _get_connected_stripe_request_options(user_id)
    person = load_person_by_id_for_user(user_id, person_id)
    resolved_customer_id = (
        str(customer_id).strip()
        if customer_id
        else str(person.get("stripe_customer_id") or "").strip() if person else ""
    ) or None

    resolved_name = customer_name or (format_person_display_name(person) if person else None)
    resolved_email = customer_email or (person.get("email") if person else None)
    resolved_phone = customer_phone or (person.get("phone") if person else None)
    metadata = build_scenario_customer_metadata(
        user_id=user_id,
        person_id=person_id or (str(person.get("id")) if person and person.get("id") is not None else None),
        appointment_id=appointment_id,
        service_id=service_id,
    )

    if resolved_customer_id:
        try:
            customer = _stripe_object_to_dict(stripe.Customer.retrieve(resolved_customer_id, **stripe_request_options))
            updates = {}
            if resolved_name and resolved_name != customer.get("name"):
                updates["name"] = resolved_name
            if resolved_email and resolved_email != customer.get("email"):
                updates["email"] = resolved_email
            if resolved_phone and resolved_phone != customer.get("phone"):
                updates["phone"] = resolved_phone
            merged_metadata = {**(customer.get("metadata") or {}), **metadata}
            if merged_metadata != (customer.get("metadata") or {}):
                updates["metadata"] = merged_metadata
            if updates:
                customer = _stripe_object_to_dict(
                    stripe.Customer.modify(resolved_customer_id, **stripe_request_options, **updates)
                )
            persist_person_stripe_customer_id(user_id, person_id, customer.get("id"))
            return customer, person
        except Exception as exc:
            if not create_if_missing:
                raise HTTPException(status_code=404, detail='The request could not be completed') from exc
            logging.warning('main.create_or_update_stripe_customer_for_user.event_3502')

    if not create_if_missing:
        raise HTTPException(status_code=400, detail="No Stripe customer could be resolved.")

    create_payload = {
        "metadata": metadata,
    }
    if resolved_name:
        create_payload["name"] = resolved_name
    if resolved_email:
        create_payload["email"] = resolved_email
    if resolved_phone:
        create_payload["phone"] = resolved_phone
    customer = _stripe_object_to_dict(stripe.Customer.create(**stripe_request_options, **create_payload))
    persist_person_stripe_customer_id(user_id, person_id, customer.get("id"))
    return customer, person


def resolve_scenario_user_id_from_stripe_event(event: dict, metadata: Optional[dict] = None) -> Optional[str]:
    # Connected-account metadata is editable by that account and cannot select
    # another Nodemere tenant. Resolve ownership from the server-stored binding.
    if event.get("account"):
        return resolve_connected_account_user_id(event["account"])
    metadata = metadata or {}
    return (
        str(metadata.get("user_id")).strip()
        if metadata.get("user_id")
        else resolve_connected_account_user_id(event.get("account"))
    ) or None

def emit_payment_trigger(trigger_key: str, payload: dict):
    trigger_payload = {
        "trigger_key": trigger_key,
        "payload": payload,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    logging.info('main.emit_payment_trigger.event_3636')
    try:
        supabase.table("scenario_events").insert(trigger_payload).execute()
    except Exception as exc:
        logging.debug('main.emit_payment_trigger.event_3543')
    schedule_backend_scenario_execution(trigger_key, payload)
    return trigger_payload

def emit_scenario_trigger(trigger_key: str, payload: Optional[dict] = None, created_at: Optional[datetime] = None):
    normalized_trigger_key = (trigger_key or "").strip()
    if not normalized_trigger_key:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="trigger_key is required")

    event_created_at = created_at or datetime.now(timezone.utc)
    if event_created_at.tzinfo is None:
        event_created_at = event_created_at.replace(tzinfo=timezone.utc)
    else:
        event_created_at = event_created_at.astimezone(timezone.utc)

    trigger_payload = {
        "trigger_key": normalized_trigger_key,
        "payload": payload or {},
        "created_at": event_created_at.isoformat(),
    }
    logging.info('main.emit_scenario_trigger.event_3660')

    saved_event = trigger_payload
    persisted = False
    try:
        response = supabase.table("scenario_events").insert(trigger_payload).execute()
        saved_event = response.data[0] if getattr(response, "data", None) else trigger_payload
        persisted = True
    except Exception as exc:
        logging.warning('main.emit_scenario_trigger.event_3572')

    schedule_backend_scenario_execution(normalized_trigger_key, payload or {})
    return {"ok": True, "event": saved_event, "persisted": persisted}


def emit_appointment_change_triggers(
    previous_appointment: Optional[dict],
    current_appointment: Optional[dict],
    *,
    business_id=None,
    include_updated: bool = True,
    source_scenario_id: Optional[str] = None,
    scenario_chain: Optional[list] = None,
):
    if not isinstance(current_appointment, dict) or not current_appointment:
        return

    resolved_business_id = (
        current_appointment.get("business_id")
        if isinstance(current_appointment, dict)
        else None
    ) or (
        previous_appointment.get("business_id")
        if isinstance(previous_appointment, dict)
        else None
    ) or business_id

    payload = {
        "appointment": current_appointment,
        "appointment_id": current_appointment.get("id"),
        "person_id": current_appointment.get("person_id"),
        "service_id": current_appointment.get("service_id"),
        "staff_id": current_appointment.get("staff_id"),
        "business_id": resolved_business_id,
    }
    if source_scenario_id not in (None, ""):
        chain = [str(item) for item in (scenario_chain or []) if item not in (None, "")]
        if str(source_scenario_id) not in chain:
            chain.append(str(source_scenario_id))
        payload["scenario_chain"] = chain

    if include_updated:
        emit_scenario_trigger("appointment_updated", payload)

    previous_status = str((previous_appointment or {}).get("status") or "").strip().lower()
    current_status = str((current_appointment or {}).get("status") or "").strip().lower()
    if current_status != previous_status:
        if current_status == "cancelled":
            emit_scenario_trigger("appointment_cancelled", payload)
        elif current_status == "confirmed":
            emit_scenario_trigger("appointment_confirmed", payload)
        elif current_status == "completed":
            emit_scenario_trigger("appointment_completed", payload)
        elif current_status == "missed":
            emit_scenario_trigger("appointment_missed", payload)

    if previous_appointment:
        previous_date = str(previous_appointment.get("date") or "").strip()
        current_date = str(current_appointment.get("date") or "").strip()
        previous_time = str(previous_appointment.get("time") or "").strip()
        current_time = str(current_appointment.get("time") or "").strip()
        if previous_date != current_date or previous_time != current_time:
            emit_scenario_trigger("appointment_rescheduled", payload)

def normalize_phone_number(value) -> Optional[str]:
    if value is None:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    digits = "".join(ch for ch in raw if ch.isdigit())
    if not digits:
        return None
    if len(digits) == 10:
        return f"+1{digits}"
    if len(digits) == 11 and digits.startswith("1"):
        return f"+{digits}"
    if raw.startswith("+"):
        return f"+{digits}"
    return digits

def build_phone_match_values(value) -> list[str]:
    normalized = normalize_phone_number(value)
    if not normalized:
        return []
    digits = "".join(ch for ch in normalized if ch.isdigit())
    values = {normalized, digits}
    if digits.startswith("1") and len(digits) == 11:
        values.add(digits[1:])
        values.add(f"+{digits[1:]}")
    return [item for item in values if item]


def format_person_display_name(person: Optional[dict]) -> Optional[str]:
    if not person:
        return None
    first_name = str(person.get("first_name") or "").strip()
    last_name = str(person.get("last_name") or "").strip()
    full_name = " ".join(part for part in [first_name, last_name] if part).strip()
    if full_name:
        return full_name
    fallback = str(person.get("name") or person.get("full_name") or "").strip()
    return fallback or None


def lookup_person_record(
    *,
    person_id: Optional[str] = None,
    phone_number: Optional[str] = None,
    business_id: Optional[str] = None,
    user_id: Optional[str] = None,
):
    try:
        if person_id:
            query = supabase.table("people").select("id,first_name,last_name,email,phone,business_id,user_id,custom_fields").eq("id", str(person_id))
            if business_id:
                query = query.eq("business_id", str(business_id))
            elif user_id:
                query = query.eq("user_id", str(user_id))
            response = query.limit(1).execute()
            if response.data:
                return response.data[0]

        match_values = set(build_phone_match_values(phone_number))
        if not match_values:
            return None

        query = supabase.table("people").select("id,first_name,last_name,email,phone,business_id,user_id,custom_fields")
        if business_id:
            query = query.eq("business_id", str(business_id))
        elif user_id:
            query = query.eq("user_id", str(user_id))
        rows = query.limit(500).execute().data or []
        for row in rows:
            if set(build_phone_match_values(row.get("phone"))) & match_values:
                return row
    except Exception as exc:
        logging.warning('main.lookup_person_record.event_3710')
    return None


def custom_dynamic_variable_name(label: Optional[str]) -> Optional[str]:
    if not label:
        return None
    key = re.sub(r"[^a-z0-9]+", "_", str(label).strip().lower()).strip("_")
    return key or None


def load_people_schema_labels(business_id: Optional[str]) -> dict:
    if not business_id:
        return {}
    try:
        rows = (
            supabase.table("people_schema")
            .select("field_key,label")
            .eq("business_id", str(business_id))
            .eq("is_active", True)
            .execute()
            .data
            or []
        )
        return {row.get("field_key"): row.get("label") for row in rows if row.get("field_key")}
    except Exception as exc:
        logging.warning('main.load_people_schema_labels.event_3736')
        return {}


def load_people_schema_rows(business_id: Optional[str]) -> list[dict]:
    if not business_id:
        return []
    try:
        return (
            supabase.table("people_schema")
            .select("field_key,label,field_type,description,config,is_active")
            .eq("business_id", str(business_id))
            .eq("is_active", True)
            .execute()
            .data
            or []
        )
    except Exception as exc:
        logging.warning('main.load_people_schema_rows.event_3754')
        return []


def load_people_schema_types(business_id: Optional[str]) -> dict:
    if not business_id:
        return {}
    try:
        rows = (
            supabase.table("people_schema")
            .select("field_key,field_type")
            .eq("business_id", str(business_id))
            .eq("is_active", True)
            .execute()
            .data
            or []
        )
        return {row.get("field_key"): row.get("field_type") for row in rows if row.get("field_key")}
    except Exception as exc:
        logging.warning('main.load_people_schema_types.event_3773')
        return {}


def coerce_people_custom_field_value(value, field_type: Optional[str]):
    if value in (None, ""):
        return value
    if field_type == "boolean":
        if isinstance(value, bool):
            return value
        normalized = str(value).strip().lower()
        if normalized in {"true", "yes", "1", "on"}:
            return True
        if normalized in {"false", "no", "0", "off"}:
            return False
    if field_type == "number":
        try:
            return float(value)
        except (TypeError, ValueError):
            return value
    if field_type == "date":
        return normalize_appointment_date_value(value, fallback=str(value).strip())
    return value


def normalize_people_payload_custom_fields(payload: dict, business_id: Optional[str], existing_custom_fields: Optional[dict] = None) -> dict:
    normalized = {**(payload or {})}
    custom_field_types = load_people_schema_types(business_id)
    merged_custom_fields = {
        **((existing_custom_fields or {}) if isinstance(existing_custom_fields, dict) else {}),
        **((normalized.get("custom_fields") or {}) if isinstance(normalized.get("custom_fields"), dict) else {}),
    }

    for key in list(normalized.keys()):
        if not str(key).startswith("custom_"):
            continue
        merged_custom_fields[key] = coerce_people_custom_field_value(normalized.pop(key), custom_field_types.get(key))

    if merged_custom_fields:
        normalized["custom_fields"] = merged_custom_fields
    elif "custom_fields" in normalized and not isinstance(normalized.get("custom_fields"), dict):
        normalized.pop("custom_fields", None)

    return normalized


def add_person_custom_dynamic_variables(dynamic_variables: dict, person: Optional[dict], business_id: Optional[str]):
    if not person or not isinstance(person.get("custom_fields"), dict):
        return dynamic_variables
    labels = load_people_schema_labels(business_id or person.get("business_id"))
    for field_key, value in person.get("custom_fields", {}).items():
        if value is None:
            continue
        dynamic_variables[field_key] = value
        label_key = custom_dynamic_variable_name(labels.get(field_key))
        if label_key and label_key not in dynamic_variables:
            dynamic_variables[label_key] = value
    return dynamic_variables


PEOPLE_INTAKE_BASE_FIELDS = {
    "first_name": {"label": "First Name", "type": "text"},
    "last_name": {"label": "Last Name", "type": "text"},
    "phone": {"label": "Phone", "type": "phone"},
    "email": {"label": "Email", "type": "email"},
    "street_address": {"label": "Street Address", "type": "text"},
    "city": {"label": "City", "type": "text"},
    "state": {"label": "State", "type": "text"},
    "zip_code": {"label": "Zip Code", "type": "text"},
    "preferred_contact_method": {"label": "Preferred Contact Method", "type": "select"},
    "preferred_language": {"label": "Preferred Language", "type": "text"},
    "best_time_to_contact": {"label": "Best Time To Contact", "type": "text"},
    "consent_sms": {"label": "Consent SMS", "type": "boolean"},
    "consent_call": {"label": "Consent Call", "type": "boolean"},
    "do_not_call": {"label": "Do Not Call", "type": "boolean"},
    "do_not_text": {"label": "Do Not Text", "type": "boolean"},
    "source": {"label": "Source", "type": "select"},
    "lead_source_detail": {"label": "Source Detail", "type": "text"},
    "special_instructions": {"label": "Special Instructions", "type": "textarea"},
}


def build_people_intake_fields(business: Optional[dict]) -> list[dict]:
    if not business:
        return []

    business_id = business.get("id")
    raw_config = business.get("people_field_config")
    config = raw_config if isinstance(raw_config, dict) else {}
    enabled_keys = [
        str(field_key)
        for field_key, field_settings in config.items()
        if isinstance(field_settings, dict) and field_settings.get("intakeEnabled") is True
    ]
    if "phone" not in enabled_keys:
        enabled_keys.insert(0, "phone")
    if not enabled_keys:
        return []

    custom_schema_rows = load_people_schema_rows(str(business_id) if business_id is not None else None)
    custom_schema_by_key = {
        str(row.get("field_key")): row
        for row in custom_schema_rows
        if row.get("field_key")
    }

    intake_fields = []
    for field_key in enabled_keys:
        field_settings = config.get(field_key) if isinstance(config.get(field_key), dict) else {}
        custom_row = custom_schema_by_key.get(field_key, {})
        config_blob = custom_row.get("config") if isinstance(custom_row.get("config"), dict) else {}
        fallback_meta = PEOPLE_INTAKE_BASE_FIELDS.get(field_key, {})
        label = (
            field_settings.get("name")
            or custom_row.get("label")
            or fallback_meta.get("label")
            or field_key
        )
        field_type = (
            custom_row.get("field_type")
            or config_blob.get("field_type")
            or fallback_meta.get("type")
            or "text"
        )
        description = (
            field_settings.get("description")
            or custom_row.get("description")
            or config_blob.get("description")
            or ""
        )

        intake_fields.append({
            "key": field_key,
            "label": label,
            "type": field_type,
            "description": description,
            "required": True,
            "custom": field_key.startswith("custom_"),
        })

    return intake_fields


def add_people_intake_dynamic_variables(dynamic_variables: dict, business: Optional[dict]):
    intake_fields = build_people_intake_fields(business)
    dynamic_variables["intake_fields_enabled_count"] = len(intake_fields)

    if not intake_fields:
        dynamic_variables["intake_fields"] = "[]"
        dynamic_variables["intake_fields_summary"] = ""
        dynamic_variables["intake_collection_guidance"] = ""
        return dynamic_variables

    summary_parts = []
    for field in intake_fields:
        label = str(field.get("label") or field.get("key") or "").strip()
        description = str(field.get("description") or "").strip()
        summary_parts.append(f"{label}: {description}" if description else label)

    dynamic_variables["intake_fields"] = json.dumps(intake_fields, ensure_ascii=True)
    dynamic_variables["intake_fields_summary"] = " | ".join(summary_parts)
    dynamic_variables["intake_collection_guidance"] = (
        "When creating a new person record, prioritize collecting every field in intake_fields. "
        "Treat them as required before the record is considered complete."
    )
    return dynamic_variables


def is_present_intake_value(value) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, (list, dict)):
        return bool(value)
    return True


def enrich_call_log_with_person(
    call_log: dict,
    *,
    payload_data: Optional[dict] = None,
    business_id: Optional[str] = None,
    user_id: Optional[str] = None,
):
    payload_data = payload_data or {}
    direction = str(
        first_present(
            payload_data,
            "direction",
            "metadata.direction",
            "metadata.phone_call.direction",
            "conversation_initiation_client_data.dynamic_variables.direction",
            "conversation_initiation_client_data.dynamic_variables.call_direction",
        )
        or ""
    ).strip().lower()
    explicit_person_id = first_present(
        payload_data,
        "person_id",
        "metadata.person_id",
        "conversation_initiation_client_data.dynamic_variables.person_id",
        "conversation_initiation_client_data.dynamic_variables.record_id",
    ) or call_log.get("person_id")
    lookup_phone = (
        call_log.get("to_number")
        if direction == "outgoing"
        else call_log.get("from_number")
    ) or call_log.get("caller_phone")

    person = lookup_person_record(
        person_id=explicit_person_id,
        phone_number=lookup_phone,
        business_id=business_id or call_log.get("business_id"),
        user_id=user_id or call_log.get("user_id"),
    )
    if person:
        call_log["person_id"] = person.get("id")
        person_name = format_person_display_name(person)
        if person_name:
            call_log["caller_name"] = person_name
        person_phone = normalize_phone_number(person.get("phone"))
        call_log["caller_phone"] = person_phone or normalize_phone_number(lookup_phone)
    elif not call_log.get("caller_phone"):
        call_log["caller_phone"] = normalize_phone_number(lookup_phone)
    return call_log

def safe_json_loads(value):
    if isinstance(value, (dict, list)):
        return value
    if value is None:
        return None
    if isinstance(value, str):
        try:
            return json.loads(value)
        except Exception:
            return value
    return value

def parse_business_hours(value):
    parsed = safe_json_loads(value)
    return parsed if parsed is not None else value

SCHEDULE_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
SCHEDULE_LAYERS = ["business", "inbound", "outbound"]

def normalize_onboarding_schedule(value):
    if not isinstance(value, dict):
        raise ValueError("Business hours must be an object.")
    if value.get("schema_version") != 1:
        raise ValueError("Unsupported business hours schema.")
    timeline = value.get("timeline") or {}
    if float(timeline.get("start", -1)) != 0 or float(timeline.get("end", -1)) != 24:
        raise ValueError("Business hours must use a 24-hour timeline.")
    schedule_days = value.get("days")
    if not isinstance(schedule_days, dict):
        raise ValueError("Business hours days are missing.")

    normalized_days = {}
    for day in SCHEDULE_DAYS:
        day_value = schedule_days.get(day)
        if not isinstance(day_value, dict):
            raise ValueError(f"Business hours are missing {day}.")
        layers = day_value.get("layers")
        if not isinstance(layers, dict):
            raise ValueError(f"Business hours layers are missing for {day}.")
        normalized_layers = {}
        for layer_name in SCHEDULE_LAYERS:
            layer = layers.get(layer_name)
            if not isinstance(layer, dict):
                raise ValueError(f"{layer_name} hours are missing for {day}.")
            try:
                start = float(layer.get("start"))
                end = float(layer.get("end"))
            except (TypeError, ValueError):
                raise ValueError(f"{layer_name} hours are invalid for {day}.")
            if start < 0 or end > 24 or start >= end:
                raise ValueError(f"{layer_name} hours are invalid for {day}.")
            normalized_layers[layer_name] = {
                "enabled": bool(layer.get("enabled")),
                "start": start,
                "end": end,
            }
        normalized_days[day] = {
            "enabled": bool(day_value.get("enabled")),
            "layers": normalized_layers,
        }

    return {
        "schema_version": 1,
        "timeline": {"start": 0, "end": 24},
        "days": normalized_days,
    }

def load_business_by_id(business_id: Optional[str]):
    if not business_id:
        return None
    try:
        response = supabase.table("businesses").select("*").eq("id", str(business_id)).limit(1).execute()
        return hydrate_business_with_purchased_number_data(response.data[0]) if response.data else None
    except Exception:
        return None

def load_business_by_user_id(user_id: Optional[str]):
    if not user_id:
        return None
    try:
        tenant = current_tenant.get()
        if tenant:
            if str(user_id) not in {tenant.actor_id, tenant.owner_id}:
                raise HTTPException(403, "Conflicting business context")
            return load_business_by_id(tenant.business_id)
        response = supabase.table("businesses").select("*").eq("user_id", str(user_id)).limit(1).execute()
        return hydrate_business_with_purchased_number_data(response.data[0]) if response.data else None
    except Exception:
        return None

def require_business_for_user(user_id: str) -> dict:
    business = load_business_by_user_id(user_id)
    if not business or business.get("id") is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    return business


def load_receptionist_by_id(receptionist_id: Optional[str]):
    if not receptionist_id:
        return None
    try:
        response = supabase.table("hired_receptionists").select("*").eq("id", str(receptionist_id)).limit(1).execute()
        return response.data[0] if response.data else None
    except Exception:
        return None

def get_receptionist_display_name(receptionist: Optional[dict]) -> Optional[str]:
    if not receptionist:
        return None
    full_name = str(receptionist.get("full_name") or "").strip()
    if full_name:
        return full_name
    first_name = str(receptionist.get("first_name") or "").strip()
    return first_name or None

def find_inbound_receptionist_for_business(business_id: Optional[str], user_id: Optional[str] = None):
    business_id_value = int_or_none(business_id)
    user_id_value = str(user_id).strip() if user_id else None
    if not business_id_value and not user_id_value:
        logging.info('main.find_inbound_receptionist_for_business.event_4174')
        return None

    rows_by_id = {}
    try:
        if business_id_value:
            response = (
                supabase
                .table("hired_receptionists")
                .select("*")
                .eq("business_id", business_id_value)
                .execute()
            )
            for row in response.data or []:
                rows_by_id[str(row.get("id"))] = row

        if user_id_value:
            response = (
                supabase
                .table("hired_receptionists")
                .select("*")
                .eq("user_id", user_id_value)
                .execute()
            )
            for row in response.data or []:
                rows_by_id[str(row.get("id"))] = row
    except Exception as exc:
        logging.warning('main.find_inbound_receptionist_for_business.event_4146')
        return None

    candidates = [
        row
        for row in rows_by_id.values()
        if receptionist_direction_allows("inbound", row.get("direction"))
    ]

    if not candidates:
        logging.info('main.find_inbound_receptionist_for_business.event_4220')
        return None

    def sort_key(row: dict):
        status_value = str(derive_receptionist_status(
            row.get("status"),
            preserve_offline=False,
            direction=row.get("direction"),
        )).strip().lower()
        is_online = status_value not in {"offline", "disabled", "inactive"}
        hired_at = str(row.get("hired_at") or "")
        return (is_online, hired_at)

    selected = sorted(candidates, key=sort_key, reverse=True)[0]
    logging.info('main.find_inbound_receptionist_for_business.event_4281')
    return selected

def find_business_by_forwarded_number(forwarded_number: Optional[str]):
    match_values = set(build_phone_match_values(forwarded_number))
    if not match_values:
        return None

    try:
        response = supabase.table("businesses").select("*").execute()
    except Exception:
        return None

    for business in response.data or []:
        config = normalize_forwarding_config(business.get("forwarding_config"))
        for entry in config.get("numbers", []):
            source_number = entry.get("source_number")
            if set(build_phone_match_values(source_number)) & match_values:
                return hydrate_business_with_purchased_number_data(business)
        if set(build_phone_match_values(business.get("phone"))) & match_values:
            return hydrate_business_with_purchased_number_data(business)
    return None


def find_business_by_called_number(called_number: Optional[str]):
    match_values = set(build_phone_match_values(called_number))
    if not match_values:
        return None

    try:
        response = supabase.table("purchased_numbers").select("business_id,phone_number,status,is_active,kind").eq("kind", "assigned_line").execute()
    except Exception:
        return None

    for row in response.data or []:
        if str(row.get("status") or "").lower() == "released":
            continue
        if set(build_phone_match_values(row.get("phone_number"))) & match_values:
            business_response = (
                supabase
                .table("businesses")
                .select("*")
                .eq("id", row.get("business_id"))
                .limit(1)
                .execute()
            )
            business = (business_response.data or [None])[0]
            if business:
                return hydrate_business_with_purchased_number_data(business)
    return None

def resolve_business_context(payload: Optional[dict] = None):
    payload = payload or {}
    bound = current_tenant.get()
    if bound:
        validate_references(getattr(supabase_admin, "raw", supabase_admin), bound, payload)
        business = load_business_by_id(bound.business_id)
        return {"business": business, "user_id": bound.owner_id,
                "receptionist": load_receptionist_by_id(first_present(payload, "receptionist_id", "hired_receptionist_id")),
                "forwarded_from": normalize_phone_number(first_present(payload, "forwarded_from", "ForwardedFrom")),
                "called_number": normalize_phone_number(first_present(payload, "to_number", "To", "Called"))}

    business_id = first_present(
        payload,
        "business_id",
        "businessId",
        "metadata.business_id",
        "dynamic_variables.business_id",
        "conversation_initiation_client_data.dynamic_variables.business_id",
    )
    user_id = first_present(
        payload,
        "user_id",
        "userId",
        "metadata.user_id",
        "dynamic_variables.user_id",
        "conversation_initiation_client_data.dynamic_variables.user_id",
    )
    receptionist_id = first_present(
        payload,
        "receptionist_id",
        "receptionistId",
        "hired_receptionist_id",
        "metadata.receptionist_id",
        "metadata.hired_receptionist_id",
        "dynamic_variables.receptionist_id",
        "dynamic_variables.hired_receptionist_id",
        "conversation_initiation_client_data.dynamic_variables.receptionist_id",
        "conversation_initiation_client_data.dynamic_variables.hired_receptionist_id",
    )
    receptionist_phone = first_present(
        payload,
        "receptionist_phone",
        "phone_number",
        "agent_phone_number",
        "to_number",
        "To",
        "Called",
        "metadata.to_number",
        "dynamic_variables.system__called_number",
        "conversation_initiation_client_data.dynamic_variables.phone_number",
        "conversation_initiation_client_data.dynamic_variables.system__called_number",
    )
    forwarded_from = first_present(
        payload,
        "forwarded_from",
        "forwardedFrom",
        "ForwardedFrom",
        "metadata.forwarded_from",
        "source_number",
        "conversation_initiation_client_data.dynamic_variables.forwarded_from",
    )
    called_number = first_present(
        payload,
        "to_number",
        "To",
        "Called",
        "called",
        "called_number",
        "agent_phone_number",
        "phone_number",
        "PhoneNumber",
        "metadata.to_number",
        "dynamic_variables.to_number",
        "dynamic_variables.called_number",
        "dynamic_variables.system__called_number",
        "conversation_initiation_client_data.dynamic_variables.to_number",
        "conversation_initiation_client_data.dynamic_variables.called_number",
        "conversation_initiation_client_data.dynamic_variables.system__called_number",
    )

    receptionist = load_receptionist_by_id(receptionist_id)
    if receptionist and not user_id:
        user_id = receptionist.get("user_id")
    if receptionist and not business_id:
        business_id = receptionist.get("business_id")

    business = load_business_by_id(business_id) if business_id else None
    if not business and called_number:
        business = find_business_by_called_number(called_number)
    if not business and user_id:
        business = load_business_by_user_id(user_id)
    if not business and forwarded_from:
        business = find_business_by_forwarded_number(forwarded_from)

    if business:
        trusted = current_tenant.get() or Tenant(str(business["user_id"]), business["id"], str(business["user_id"]), service=True)
        validate_references(getattr(supabase_admin, "raw", supabase_admin), trusted, payload)
        if receptionist:
            require_record(getattr(supabase_admin, "raw", supabase_admin), trusted, "hired_receptionists", receptionist["id"])
        user_id = business["user_id"]

    return {
        "business": business,
        "user_id": str(user_id or business.get("user_id")) if (user_id or business) else None,
        "receptionist": receptionist,
        "forwarded_from": normalize_phone_number(forwarded_from),
        "called_number": normalize_phone_number(called_number),
    }

async def parse_request_payload(request: Request) -> dict:
    content_type = (request.headers.get("content-type") or "").lower()

    if "application/json" in content_type:
        try:
            payload = await request.json()
            return payload if isinstance(payload, dict) else {}
        except Exception:
            return {}

    if "application/x-www-form-urlencoded" in content_type or "multipart/form-data" in content_type:
        try:
            form = await request.form()
            return {key: value for key, value in form.multi_items()}
        except Exception:
            return {}

    try:
        payload = await request.json()
        if isinstance(payload, dict):
            return payload
    except Exception:
        pass

    return dict(request.query_params)

def serialize_business_profile_row(row: dict):
    if not row:
        return None
    return {
        **row,
        "business_hours": parse_business_hours(row.get("business_hours")),
        "industry": safe_json_loads(row.get("industry")),
        "forwarding_config": normalize_forwarding_config(row.get("forwarding_config")),
    }


# Tool responses deliberately exclude billing, security, consent evidence and
# provider configuration. These are operational/public business facts only.
TOOL_BUSINESS_FIELDS = ('id', 'name', 'phone', 'email', 'address', 'city', 'state',
    'zip', 'website', 'about_us', 'policies', 'faq', 'business_hours', 'business_timezone', 'industry')
TOOL_STAFF_FIELDS = ('id', 'full_name', 'first_name', 'last_name', 'role',
    'is_active', 'working_hours', 'knowledge')


def staff_tool_view(row):
    return {key: row[key] for key in TOOL_STAFF_FIELDS if key in row} if row else None

def parse_usage_seconds(value) -> int:
    try:
        return max(0, int(float(value or 0)))
    except (TypeError, ValueError):
        return 0

def increment_business_usage_summary(business_id, duration_delta_seconds) -> None:
    business_id = int_or_none(business_id)
    duration_delta_seconds = parse_usage_seconds(duration_delta_seconds)
    if not business_id or duration_delta_seconds <= 0:
        return

    try:
        try:
            supabase.rpc("increment_business_cycle_usage", {
                "business_id_param": business_id,
                "duration_delta_seconds_param": duration_delta_seconds,
            }).execute()
            return
        except Exception as rpc_exc:
            logging.warning('main.increment_business_usage_summary.event_4386')

        response = (
            supabase.table("businesses")
            .select("current_cycle_used_seconds,current_cycle_included_seconds")
            .eq("id", business_id)
            .limit(1)
            .execute()
        )
        business = response.data[0] if getattr(response, "data", None) else None
        if not business:
            return

        used_seconds = int(business.get("current_cycle_used_seconds") or 0) + duration_delta_seconds
        included_seconds = int(business.get("current_cycle_included_seconds") or 0)
        overage_seconds = max(0, used_seconds - included_seconds)

        supabase.table("businesses").update({
            "current_cycle_used_seconds": used_seconds,
            "current_cycle_overage_seconds": overage_seconds,
        }).eq("id", business_id).execute()
    except Exception as exc:
        logging.error('main.increment_business_usage_summary.event_4413')

def sync_business_plan_entitlement(user_id, plan_name, period_start=None, period_end=None, reset_usage=False) -> None:
    """Copy the active plan's minute allowance into the business usage summary."""
    if not user_id:
        return

    try:
        plan_slug = str(plan_name or "free").strip().lower()
        plan_response = (
            supabase_admin.table("plans")
            .select("entitlements")
            .eq("slug", plan_slug)
            .limit(1)
            .execute()
        )
        plan_row = plan_response.data[0] if getattr(plan_response, "data", None) else None
        entitlements = plan_row.get("entitlements") if plan_row else {}
        included_minutes = int((entitlements or {}).get("included_call_minutes") or 0)
        included_seconds = max(0, included_minutes * 60)

        business_response = (
            supabase_admin.table("businesses")
            .select("id")
            .eq("user_id", str(user_id))
            .limit(1)
            .execute()
        )
        business = business_response.data[0] if getattr(business_response, "data", None) else None
        if not business:
            return

        update_data = {
            "current_cycle_included_seconds": included_seconds,
            "current_cycle_started_at": period_start,
            "current_cycle_ends_at": period_end,
        }
        if reset_usage:
            update_data.update({
                "current_cycle_used_seconds": 0,
                "current_cycle_overage_seconds": 0,
            })
        supabase_admin.table("businesses").update(update_data).eq("id", business["id"]).execute()
    except Exception as exc:
        logging.error('main.sync_business_plan_entitlement.event_4457')


# Plan access is evaluated from the authenticated user's current profile and
# the server-owned entitlement table. The browser may display these values,
# but it is never trusted to enforce them.
DEFAULT_PLAN_ENTITLEMENTS = {
    "free": {"included_call_minutes": 20, "max_receptionists": 1, "max_scenarios": 3, "max_contacts": 100, "inbound_calling": True, "outbound_calling": False, "overage_enabled": False, "payment_processing": False},
    "essentials": {"included_call_minutes": 300, "max_receptionists": 3, "max_scenarios": None, "max_contacts": 1000, "inbound_calling": True, "outbound_calling": False, "overage_enabled": True, "overage_cap_cents": 2500, "payment_processing": False},
    "pro": {"included_call_minutes": 1500, "max_receptionists": None, "max_scenarios": None, "max_contacts": None, "inbound_calling": True, "outbound_calling": True, "overage_enabled": True, "overage_cap_cents": 10000, "payment_processing": True},
    "ultra": {"included_call_minutes": 3000, "max_receptionists": None, "max_scenarios": None, "max_contacts": None, "inbound_calling": True, "outbound_calling": True, "overage_enabled": True, "overage_cap_cents": 25000, "payment_processing": True},
}
SUBSCRIPTION_ACCESS_STATUSES = {"active"}


def get_user_plan_context(user_id: str) -> dict:
    profile_response = (
        supabase_admin.table("users")
        .select("id,plan,subscription_status,stripe_subscription_id,stripe_customer_id")
        .eq("id", str(user_id))
        .limit(1)
        .execute()
    )
    profile = (profile_response.data or [None])[0]
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found")

    plan_slug = str(profile.get("plan") or "free").strip().lower()
    if plan_slug not in DEFAULT_PLAN_ENTITLEMENTS:
        plan_slug = "free"
    entitlements = dict(DEFAULT_PLAN_ENTITLEMENTS[plan_slug])
    try:
        plan_response = (
            supabase_admin.table("plans")
            .select("slug,entitlements")
            .eq("slug", plan_slug)
            .limit(1)
            .execute()
        )
        plan_row = (plan_response.data or [None])[0]
        if isinstance(plan_row and plan_row.get("entitlements"), dict):
            entitlements.update(plan_row["entitlements"])
    except Exception as exc:
        logging.warning('main.get_user_plan_context.event_4495')

    return {
        "user": profile,
        "plan": plan_slug,
        "status": str(profile.get("subscription_status") or "").strip().lower(),
        "entitlements": entitlements,
    }


def require_plan_access(user_id: str, feature: str) -> dict:
    context = get_user_plan_context(user_id)
    if context["plan"] != "free" and context["status"] not in SUBSCRIPTION_ACCESS_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "code": "subscription_inactive",
                "feature": feature,
                "message": "Your subscription is not active. Open Stripe Billing Portal to update billing.",
                "plan": context["plan"],
                "subscription_status": context["status"] or "unknown",
            },
        )
    return context


def require_payment_access(user_id: str) -> dict:
    """Enforce payment access from the server-owned plan entitlements."""
    context = require_plan_access(user_id, "payments")
    if context["entitlements"].get("payment_processing") is not True:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "code": "feature_not_in_plan",
                "feature": "payments",
                "plan": context["plan"],
                "message": "Payments and invoicing are available on the Pro and Ultra plans.",
            },
        )
    return context


def enforce_plan_limit(context: dict, resource: str, current_count: int, limit_key: str) -> None:
    raw_limit = context["entitlements"].get(limit_key)
    if raw_limit is None:
        return
    try:
        limit = int(raw_limit)
    except (TypeError, ValueError):
        return
    if current_count >= limit:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "code": "plan_limit_reached",
                "resource": resource,
                "limit": limit,
                "current": current_count,
                "plan": context["plan"],
                "message": f"Your {context['plan'].capitalize()} plan allows {limit} {resource}. Upgrade in Stripe Billing Portal to add more.",
            },
        )


def count_user_rows(table_name: str, user_id: str, *, business_id: Optional[int] = None) -> int:
    query = supabase_admin.table(table_name).select("id")
    query = query.eq("business_id", business_id) if business_id is not None else query.eq("user_id", str(user_id))
    return len(query.execute().data or [])


def count_active_receptionists(user_id: str) -> int:
    response = (
        supabase_admin.table("hired_receptionists")
        .select("id,is_active,status")
        .eq("user_id", str(user_id))
        .execute()
    )
    inactive_statuses = {"archived", "inactive", "disabled", "terminated"}
    return len([
        row for row in (response.data or [])
        if row.get("is_active") is not False
        and str(row.get("status") or "").strip().lower() not in inactive_statuses
    ])


def enforce_call_minutes(user_id: str, business: Optional[dict], *, direction: str = "inbound") -> dict:
    normalized_user_id = str(user_id or "").strip()
    if not normalized_user_id:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "code": "billing_context_missing",
                "feature": f"{direction}_calling",
                "message": "This call could not be started because the account billing context could not be verified.",
            },
        )

    if not business:
        business = load_business_by_user_id(normalized_user_id)
    business_owner_id = str((business or {}).get("user_id") or "").strip()
    if not business or (business_owner_id and business_owner_id != normalized_user_id):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "code": "billing_context_missing",
                "feature": f"{direction}_calling",
                "message": "Finish setting up your business before calls can run. Billing could not be verified for this account.",
            },
        )

    context = require_plan_access(normalized_user_id, f"{direction}_calling")
    if direction == "outbound" and context["entitlements"].get("outbound_calling") is not True:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "code": "feature_not_in_plan",
                "feature": "outbound_calling",
                "plan": context["plan"],
                "message": "Outbound calling is available on the Pro and Ultra plans.",
            },
        )
    used_seconds = parse_usage_seconds(business.get("current_cycle_used_seconds"))
    entitled_seconds = int(context["entitlements"].get("included_call_minutes") or 0) * 60
    included_seconds = entitled_seconds if entitled_seconds > 0 else parse_usage_seconds(business.get("current_cycle_included_seconds"))
    overage_seconds = max(0, used_seconds - included_seconds)
    overage_rate_cents = int(context["entitlements"].get("overage_price_per_minute_cents") or 30)
    billable_overage_minutes = math.ceil(overage_seconds / 60) if overage_seconds else 0
    estimated_overage_amount_cents = billable_overage_minutes * overage_rate_cents
    overage_enabled = context["entitlements"].get("overage_enabled") is True
    overage_cap_cents = int(context["entitlements"].get("overage_cap_cents") or 0)

    if used_seconds >= included_seconds and not overage_enabled:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "code": "minute_limit_reached",
                "resource": "call minutes",
                "limit": included_seconds // 60,
                "current": used_seconds // 60,
                "plan": context["plan"],
                "message": "Your included call minutes are used. Upgrade in Stripe Billing Portal to continue calling.",
            },
        )
    if overage_enabled and overage_cap_cents > 0 and estimated_overage_amount_cents >= overage_cap_cents:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "code": "overage_limit_reached",
                "resource": "call minutes",
                "plan": context["plan"],
                "overage_cap_cents": overage_cap_cents,
                "estimated_overage_amount_cents": estimated_overage_amount_cents,
                "message": "Your account reached its call overage limit. Open Stripe Billing Portal to update your billing before more calls can run.",
            },
        )
    return context


def get_usage_snapshot(user_id: str) -> dict:
    context = get_user_plan_context(user_id)
    business = load_business_by_user_id(user_id) or {}
    used_seconds = parse_usage_seconds(business.get("current_cycle_used_seconds"))
    entitled_seconds = int(context["entitlements"].get("included_call_minutes") or 0) * 60
    included_seconds = entitled_seconds if entitled_seconds > 0 else parse_usage_seconds(business.get("current_cycle_included_seconds"))
    overage_seconds = max(0, used_seconds - included_seconds)
    overage_rate_cents = int(context["entitlements"].get("overage_price_per_minute_cents") or 30)
    billable_overage_minutes = math.ceil(overage_seconds / 60) if overage_seconds else 0
    estimated_overage_amount_cents = billable_overage_minutes * overage_rate_cents
    overage_cap_cents = int(context["entitlements"].get("overage_cap_cents") or 0)
    overage_limit_reached = bool(
        context["entitlements"].get("overage_enabled") is True
        and overage_cap_cents > 0
        and estimated_overage_amount_cents >= overage_cap_cents
    )
    usage_percent = (used_seconds / included_seconds * 100) if included_seconds else 0
    if overage_seconds > 0 and context["entitlements"].get("overage_enabled") is True:
        alert_level = "overage"
    elif usage_percent >= 100:
        alert_level = "limit"
    elif usage_percent >= 80:
        alert_level = "warning"
    else:
        alert_level = "normal"
    return {
        "business_id": business.get("id"),
        "plan": context["plan"],
        "subscription_status": context["status"] or "unknown",
        "included_seconds": included_seconds,
        "used_seconds": used_seconds,
        "overage_seconds": overage_seconds,
        "current_cycle_included_seconds": included_seconds,
        "current_cycle_used_seconds": used_seconds,
        "current_cycle_overage_seconds": overage_seconds,
        "billable_overage_minutes": billable_overage_minutes,
        "overage_price_per_minute_cents": overage_rate_cents,
        "estimated_overage_amount_cents": estimated_overage_amount_cents,
        "overage_cap_cents": overage_cap_cents or None,
        "remaining_overage_cap_cents": max(0, overage_cap_cents - estimated_overage_amount_cents) if overage_cap_cents else None,
        "overage_limit_reached": overage_limit_reached,
        "billing_access": context["plan"] == "free" or context["status"] in SUBSCRIPTION_ACCESS_STATUSES,
        "overage_enabled": context["entitlements"].get("overage_enabled") is True,
        "usage_percent": round(usage_percent, 2),
        "alert_level": alert_level,
        "cycle_started_at": business.get("current_cycle_started_at"),
        "cycle_ends_at": business.get("current_cycle_ends_at"),
    }


def attach_overage_to_upcoming_invoice(invoice: dict) -> None:
    """Create one idempotent Stripe invoice item for the current usage cycle."""
    if is_payment_test_mode():
        logging.info('main.attach_overage_to_upcoming_invoice.event_4775')
        return
    customer_id = invoice.get("customer")
    invoice_id = invoice.get("id")
    if not customer_id or not invoice_id:
        return

    user_response = (
        supabase_admin.table("users")
        .select("id,plan,subscription_status")
        .eq("stripe_customer_id", customer_id)
        .limit(1)
        .execute()
    )
    user = (user_response.data or [None])[0]
    if not user:
        logging.warning('main.attach_overage_to_upcoming_invoice.event_4791')
        return

    context = get_user_plan_context(str(user["id"]))
    if context["entitlements"].get("overage_enabled") is not True:
        return

    usage = get_usage_snapshot(str(user["id"]))
    if usage["billable_overage_minutes"] <= 0:
        return

    existing_response = (
        supabase_admin.table("billing_overage_events")
        .select("*")
        .eq("user_id", str(user["id"]))
        .eq("stripe_invoice_id", invoice_id)
        .limit(1)
        .execute()
    )
    existing = (existing_response.data or [None])[0]
    if existing and existing.get("stripe_invoice_item_id"):
        return

    event_payload = {
        "user_id": str(user["id"]),
        "business_id": usage.get("business_id"),
        "stripe_customer_id": customer_id,
        "stripe_invoice_id": invoice_id,
        "billing_period_start": datetime.fromtimestamp(invoice["period_start"], timezone.utc).isoformat() if invoice.get("period_start") else usage.get("cycle_started_at"),
        "billing_period_end": datetime.fromtimestamp(invoice["period_end"], timezone.utc).isoformat() if invoice.get("period_end") else usage.get("cycle_ends_at"),
        "overage_seconds": usage["overage_seconds"],
        "billable_minutes": usage["billable_overage_minutes"],
        "amount_cents": usage["estimated_overage_amount_cents"],
        "currency": str(invoice.get("currency") or "usd").lower(),
        "status": "pending",
    }
    try:
        if not existing:
            insert_response = supabase_admin.table("billing_overage_events").insert(event_payload).execute()
            existing = (insert_response.data or [None])[0]
        if existing and existing.get("stripe_invoice_item_id"):
            return

        item = stripe.InvoiceItem.create(
            customer=customer_id,
            invoice=invoice_id,
            amount=event_payload["amount_cents"],
            currency=event_payload["currency"],
            description=f"Nodemere call overage: {event_payload['billable_minutes']} minute(s)",
            metadata={
                "nodemere_user_id": str(user["id"]),
                "nodemere_overage_event_id": str((existing or {}).get("id") or ""),
            },
            idempotency_key=f"nodemere-overage-{invoice_id}-{user['id']}",
        )
        supabase_admin.table("billing_overage_events").update({
            "stripe_invoice_item_id": item.get("id"),
            "status": "invoiced",
            "error_message": None,
        }).eq("user_id", str(user["id"])).eq("stripe_invoice_id", invoice_id).execute()
        logging.info('main.attach_overage_to_upcoming_invoice.event_4815')
    except Exception as exc:
        logging.error('main.attach_overage_to_upcoming_invoice.event_4784')
        supabase_admin.table("billing_overage_events").update({
            "status": "failed",
            "error_message": str(exc)[:1000],
        }).eq("user_id", str(user["id"])).eq("stripe_invoice_id", invoice_id).execute()


def reconcile_overage_invoice(invoice_id: Optional[str], status_value: str) -> None:
    if not invoice_id:
        return
    update_data = {"status": status_value}
    if status_value in {"paid", "void"}:
        update_data["reconciled_at"] = datetime.now(timezone.utc).isoformat()
    try:
        supabase_admin.table("billing_overage_events").update(update_data).eq("stripe_invoice_id", invoice_id).execute()
    except Exception as exc:
        logging.error('main.reconcile_overage_invoice.event_4800')

def build_call_route_payload(payload: dict, request: Request):
    forwarded_from = first_present(payload, "forwarded_from", "forwardedFrom", "ForwardedFrom", "source_number")
    trigger_key = first_present(payload, "trigger_key", "trigger", "event", "type")
    if not trigger_key:
        call_status = str(first_present(payload, "call_status", "CallStatus", "status") or "").strip().lower()
        if call_status in {"no-answer", "busy"}:
            trigger_key = "missed_call"
        elif call_status in {"failed", "canceled"}:
            trigger_key = "call_failed"
        elif call_status in {"in-progress", "ringing", "queued"}:
            trigger_key = "incoming_call"
        elif call_status == "completed":
            trigger_key = "call_answered"
        else:
            trigger_key = "incoming_call"

    call_payload = {
        "trigger_key": str(trigger_key).strip().lower().replace(" ", "_"),
        "call_id": first_present(payload, "call_id", "call_sid", "CallSid", "callSid", "conversation_id"),
        "conversation_id": first_present(payload, "conversation_id", "ConversationSid"),
        "from_number": normalize_phone_number(first_present(
            payload,
            "from_number",
            "From",
            "caller_phone",
            "caller",
            "caller_id",
            "dynamic_variables.system__caller_id",
            "conversation_initiation_client_data.dynamic_variables.system__caller_id",
        )),
        "to_number": normalize_phone_number(first_present(
            payload,
            "to_number",
            "To",
            "agent_phone_number",
            "phone_number",
            "called_number",
            "Called",
            "dynamic_variables.system__called_number",
            "conversation_initiation_client_data.dynamic_variables.system__called_number",
        )),
        "forwarded_from": normalize_phone_number(forwarded_from),
        "call_status": first_present(payload, "call_status", "CallStatus", "status"),
        "direction": first_present(payload, "direction", "Direction"),
        "provider": first_present(payload, "provider", "source") or ("elevenlabs" if first_present(payload, "agent_id") else "unknown"),
        "received_at": datetime.now(timezone.utc).isoformat(),
        "path": request.url.path,
        "raw_payload": event_metadata(payload),
    }
    return call_payload

def upsert_active_call_log(call_payload: dict, *, user_id: Optional[str], business_id: Optional[str], receptionist: Optional[dict]) -> None:
    """Create the live call row that NEST uses until the post-call webhook arrives."""
    provider_call_sid = call_payload.get("call_id")
    conversation_id = call_payload.get("conversation_id")
    if not provider_call_sid and not conversation_id:
        logging.warning('main.upsert_active_call_log.event_4891')
        return

    row = {
        "source": "elevenlabs_initiation",
        "provider_call_sid": str(provider_call_sid) if provider_call_sid else None,
        "conversation_id": str(conversation_id) if conversation_id else None,
        "user_id": user_id,
        "business_id": business_id,
        "hired_receptionist_id": (receptionist or {}).get("id"),
        "receptionist_name": get_receptionist_display_name(receptionist),
        "from_number": call_payload.get("from_number"),
        "to_number": call_payload.get("to_number"),
        "direction": call_payload.get("direction") or "inbound",
        "started_at": call_payload.get("received_at") or datetime.now(timezone.utc).isoformat(),
        "status": "in-progress",
        "raw_payload": event_metadata(call_payload.get("raw_payload")),
    }
    row = {key: value for key, value in row.items() if value is not None}
    try:
        existing = []
        if conversation_id:
            existing = supabase.table("call_logs").select("id").eq("conversation_id", str(conversation_id)).limit(1).execute().data or []
        if not existing and provider_call_sid:
            existing = supabase.table("call_logs").select("id").eq("provider_call_sid", str(provider_call_sid)).limit(1).execute().data or []
        if existing:
            supabase.table("call_logs").update(row).eq("id", existing[0]["id"]).execute()
        else:
            supabase.table("call_logs").insert(row).execute()
    except Exception as exc:
        # The call itself must continue even if NEST's live indicator cannot be persisted.
        logging.warning('main.upsert_active_call_log.event_4889')

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


def blank_to_none(value):
    if isinstance(value, str):
        stripped = value.strip()
        return stripped if stripped else None
    return value


def normalize_appointment_status(value, fallback: str = "pending") -> str:
    normalized = str(value or "").strip().lower()
    if normalized in APPOINTMENT_ALLOWED_STATUSES:
        return normalized
    return fallback


def normalize_appointment_duration(value, fallback: int = 30) -> int:
    try:
        parsed = int(value)
    except Exception:
        return fallback
    if parsed <= 0:
        return fallback
    return min(parsed, 1440)


def normalize_appointment_date_value(value, fallback: str | None = None) -> str:
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, str):
        stripped = value.strip()
        if stripped:
            candidate = stripped.replace("Z", "+00:00")
            try:
                return datetime.fromisoformat(candidate).date().isoformat()
            except ValueError:
                pass
            for fmt in (
                "%Y-%m-%d",
                "%m/%d/%Y",
                "%m-%d-%Y",
                "%m/%d/%y",
                "%m-%d-%y",
                "%B %d, %Y",
                "%b %d, %Y",
                "%B %d %Y",
                "%b %d %Y",
            ):
                try:
                    return datetime.strptime(stripped, fmt).date().isoformat()
                except ValueError:
                    continue
    return fallback or datetime.now().date().isoformat()


def normalize_appointment_time_value(value, fallback: str = "09:00") -> str:
    if isinstance(value, datetime):
        return value.strftime("%H:%M")
    if isinstance(value, str):
        stripped = value.strip()
        if stripped:
            try:
                return datetime.strptime(stripped, "%H:%M").strftime("%H:%M")
            except ValueError:
                pass
            for fmt in ("%I:%M %p", "%I:%M%p", "%I %p", "%I%p"):
                try:
                    return datetime.strptime(stripped.upper(), fmt).strftime("%H:%M")
                except ValueError:
                    continue
            return stripped
    return fallback


def safe_appointment_person_id(value, *, business_id):
    parsed = int_or_none(value)
    if parsed is None or business_id is None:
        return None
    try:
        response = supabase.table("people").select("id").eq("id", parsed).eq("business_id", business_id).limit(1).execute()
        return parsed if response.data else None
    except Exception:
        return None


def safe_appointment_service_id(value, *, business_id):
    parsed = uuid_or_none(value)
    if not parsed or business_id is None:
        return None
    try:
        response = supabase.table("services").select("id").eq("id", parsed).eq("business_id", business_id).limit(1).execute()
        return parsed if response.data else None
    except Exception:
        return None


def load_staff_record(value, *, business_id=None, require_active: bool = False):
    parsed = uuid_or_none(value)
    if not parsed:
        return None
    try:
        query = supabase.table("staff").select("*").eq("id", parsed)
        if business_id is not None:
            query = query.eq("business_id", business_id)
        response = query.limit(1).execute()
        if not response.data:
            return None
        staff = response.data[0]
        if require_active and staff.get("is_active") is False:
            return None
        return staff
    except Exception:
        return None


def safe_appointment_staff_id(value, *, business_id=None, require_active: bool = False):
    staff = load_staff_record(value, business_id=business_id, require_active=require_active)
    return staff.get("id") if staff else None


def appointment_time_to_minutes(value) -> Optional[int]:
    normalized = normalize_appointment_time_value(value, fallback="")
    if not normalized:
        return None
    parts = str(normalized).split(":")
    if len(parts) < 2:
        return None
    try:
        hour = int(parts[0])
        minute = int(parts[1])
    except (TypeError, ValueError):
        return None
    if hour < 0 or hour > 23 or minute < 0 or minute > 59:
        return None
    return (hour * 60) + minute


def normalize_working_hours_key(value: str) -> str:
    return "".join(ch for ch in str(value or "").strip().lower() if ch.isalpha())


def get_business_timezone(business: Optional[dict]):
    timezone_name = (business or {}).get("business_timezone") or "UTC"
    try:
        return ZoneInfo(str(timezone_name))
    except Exception:
        return timezone.utc


def decimal_hours_to_minutes(value) -> Optional[int]:
    try:
        minutes = round(float(value) * 60)
    except (TypeError, ValueError):
        return None
    return minutes if 0 <= minutes <= 1440 else None


def get_business_schedule_for_date(business: Optional[dict], schedule_date: Optional[str], layer: str = "business"):
    """Return a normalized schedule window for a business day and layer."""
    if not isinstance(business, dict) or not schedule_date or layer not in SCHEDULE_LAYERS:
        return None

    normalized_date = normalize_appointment_date_value(schedule_date, fallback=None)
    if not normalized_date:
        return None
    try:
        weekday = datetime.fromisoformat(normalized_date).strftime("%A")
    except ValueError:
        return None

    business_hours = parse_business_hours(business.get("business_hours"))
    if not isinstance(business_hours, dict):
        return None

    # The current Settings/Onboarding format stores independent decimal-hour
    # windows for business, inbound, and outbound use.
    if business_hours.get("schema_version") == 1 and isinstance(business_hours.get("days"), dict):
        day_value = business_hours["days"].get(weekday)
        layer_value = (day_value or {}).get("layers", {}).get(layer) if isinstance(day_value, dict) else None
        if not isinstance(day_value, dict) or not isinstance(layer_value, dict):
            return None
        start_minutes = decimal_hours_to_minutes(layer_value.get("start"))
        end_minutes = decimal_hours_to_minutes(layer_value.get("end"))
        if start_minutes is None or end_minutes is None or start_minutes >= end_minutes:
            return None
        return {
            "enabled": bool(day_value.get("enabled")) and bool(layer_value.get("enabled")),
            "start_minutes": start_minutes,
            "end_minutes": end_minutes,
        }

    # Preserve compatibility with older flat business-hour records. They only
    # describe the business layer; missing channel layers remain unrestricted.
    if layer != "business":
        return None
    day_value = next(
        (
            value for key, value in business_hours.items()
            if normalize_working_hours_key(key) == normalize_working_hours_key(weekday)
            and isinstance(value, dict)
        ),
        None,
    )
    if not day_value:
        return None
    start_minutes = appointment_time_to_minutes(day_value.get("open"))
    end_minutes = appointment_time_to_minutes(day_value.get("close"))
    if start_minutes is None or end_minutes is None or start_minutes >= end_minutes:
        return None
    return {
        "enabled": day_value.get("enabled") is not False,
        "start_minutes": start_minutes,
        "end_minutes": end_minutes,
    }


def is_business_available_during_hours(
    business: Optional[dict],
    appointment_date: Optional[str],
    appointment_time: Optional[str],
    duration: int,
    layer: str = "business",
):
    schedule = get_business_schedule_for_date(business, appointment_date, layer=layer)
    if schedule is None:
        return True, None
    if not schedule["enabled"]:
        return False, f"Business {layer} hours are closed"

    start_minutes = appointment_time_to_minutes(appointment_time)
    if start_minutes is None:
        return True, None
    end_minutes = start_minutes + normalize_appointment_duration(duration)
    if start_minutes < schedule["start_minutes"] or end_minutes > schedule["end_minutes"]:
        return False, f"Requested time is outside business {layer} hours"
    return True, None


def is_business_call_window_open(business: Optional[dict], layer: str = "inbound", at: Optional[datetime] = None):
    """Evaluate a live call window using the business's configured timezone."""
    if not isinstance(business, dict):
        return True, None
    local_now = (at or datetime.now(timezone.utc)).astimezone(get_business_timezone(business))
    schedule = get_business_schedule_for_date(business, local_now.date().isoformat(), layer=layer)
    if schedule is None:
        return True, None
    if not schedule["enabled"]:
        return False, f"Business {layer} hours are closed"
    current_minutes = local_now.hour * 60 + local_now.minute
    if current_minutes < schedule["start_minutes"] or current_minutes >= schedule["end_minutes"]:
        return False, f"Business {layer} hours are closed"
    return True, None


def tokenize_search_terms(*values) -> list[str]:
    terms: list[str] = []
    for value in values:
        raw = str(value or "").strip().lower()
        if not raw:
            continue
        pieces = [piece for piece in re.split(r"[^a-z0-9]+", raw) if piece]
        terms.extend(pieces or [raw])
    seen = set()
    ordered = []
    for term in terms:
        if term in seen:
            continue
        seen.add(term)
        ordered.append(term)
    return ordered


def score_staff_match(staff: dict, search_terms: list[str]) -> int:
    if not search_terms:
        return 1
    haystacks = [
        str(staff.get("full_name") or "").lower(),
        str(staff.get("first_name") or "").lower(),
        str(staff.get("last_name") or "").lower(),
        str(staff.get("role") or "").lower(),
        str(staff.get("notes") or "").lower(),
    ]
    score = 0
    for term in search_terms:
        for haystack in haystacks:
            if not haystack:
                continue
            if term == haystack:
                score += 6
            elif term in haystack:
                score += 3
    return score


def get_staff_schedule_for_date(working_hours, appointment_date: Optional[str]):
    if not isinstance(working_hours, dict) or not appointment_date:
        return None
    try:
        weekday_name = datetime.fromisoformat(str(appointment_date)).strftime("%A").lower()
    except ValueError:
        return None

    candidate_keys = {
        weekday_name,
        weekday_name[:3],
        normalize_working_hours_key(weekday_name),
        normalize_working_hours_key(weekday_name[:3]),
    }

    for key, value in working_hours.items():
        if normalize_working_hours_key(key) in candidate_keys and isinstance(value, dict):
            return value
    return None


def is_staff_available_during_hours(staff: Optional[dict], appointment_date: Optional[str], appointment_time: Optional[str], duration: int):
    if not isinstance(staff, dict):
        return False, "Staff record not found"
    if staff.get("is_active") is False:
        return False, "Staff member is inactive"

    schedule = get_staff_schedule_for_date(staff.get("working_hours"), appointment_date)
    if schedule is None:
        return True, None

    enabled = schedule.get("enabled")
    if enabled is False:
        return False, "Staff member is not working that day"

    start_minutes = appointment_time_to_minutes(appointment_time)
    open_minutes = appointment_time_to_minutes(schedule.get("open"))
    close_minutes = appointment_time_to_minutes(schedule.get("close"))
    duration_minutes = normalize_appointment_duration(duration)

    if start_minutes is None or open_minutes is None or close_minutes is None:
        return True, None

    end_minutes = start_minutes + duration_minutes
    if start_minutes < open_minutes or end_minutes > close_minutes:
        return False, "Requested time is outside staff working hours"

    return True, None


def appointments_conflict(start_a: Optional[int], duration_a: int, start_b: Optional[int], duration_b: int) -> bool:
    if start_a is None or start_b is None:
        return False
    end_a = start_a + normalize_appointment_duration(duration_a)
    end_b = start_b + normalize_appointment_duration(duration_b)
    return start_a < end_b and start_b < end_a


def list_staff_conflicts(*, business_id, appointment_date, appointment_time, duration, staff_id=None, exclude_appointment_id=None):
    query = supabase.table("appointments").select("id,staff_id,date,time,duration,status")
    if business_id is not None:
        query = query.eq("business_id", business_id)
    if appointment_date:
        query = query.eq("date", appointment_date)
    if staff_id:
        query = query.eq("staff_id", staff_id)
    rows = query.limit(500).execute().data or []
    normalized_target_start = appointment_time_to_minutes(appointment_time)
    normalized_target_duration = normalize_appointment_duration(duration)
    blocked_statuses = {"cancelled", "completed", "missed"}
    conflicts = []
    for row in rows:
        if exclude_appointment_id and str(row.get("id")) == str(exclude_appointment_id):
            continue
        if str(row.get("status") or "").strip().lower() in blocked_statuses:
            continue
        if staff_id and str(row.get("staff_id") or "") != str(staff_id):
            continue
        if appointments_conflict(
            normalized_target_start,
            normalized_target_duration,
            appointment_time_to_minutes(row.get("time")),
            row.get("duration"),
        ):
            # The caller needs busy intervals, not the other patient's record.
            conflicts.append({key: row.get(key) for key in ('staff_id', 'date', 'time', 'duration')})
    return conflicts


def validate_appointment_schedule(
    business: Optional[dict],
    appointment_date: str,
    appointment_time: str,
    duration: int,
    staff_id=None,
    exclude_appointment_id=None,
):
    within_business_hours, business_reason = is_business_available_during_hours(
        business,
        appointment_date,
        appointment_time,
        duration,
        layer="business",
    )
    if not within_business_hours:
        return False, business_reason, []

    if not staff_id:
        return True, None, []
    staff = load_staff_record(staff_id, business_id=(business or {}).get("id"), require_active=False)
    if not staff:
        return False, "Staff member not found", []
    within_staff_hours, staff_reason = is_staff_available_during_hours(
        staff,
        appointment_date,
        appointment_time,
        duration,
    )
    if not within_staff_hours:
        return False, staff_reason, []
    conflicts = list_staff_conflicts(
        business_id=(business or {}).get("id"),
        appointment_date=appointment_date,
        appointment_time=appointment_time,
        duration=duration,
        staff_id=staff.get("id"),
        exclude_appointment_id=exclude_appointment_id,
    )
    if conflicts:
        return False, "Requested time conflicts with an existing appointment", conflicts
    return True, None, []

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

def epoch_to_iso(value):
    parsed = parse_optional_datetime(value)
    return parsed.isoformat() if parsed else None

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

def sanitize_storage_segment(value: Optional[str], fallback: str = "unknown") -> str:
    raw = str(value or fallback).strip() or fallback
    return "".join(ch if ch.isalnum() or ch in {"-", "_"} else "-" for ch in raw)[:120] or fallback

def int_or_none(value):
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None

def uuid_or_none(value):
    if value is None or value == "":
        return None
    try:
        return str(UUID(str(value)))
    except (TypeError, ValueError):
        return None

def get_elevenlabs_event_data(payload: dict) -> tuple[str, Optional[str], dict]:
    webhook_type = str(payload.get("type") or "post_call_transcription").strip()
    event_timestamp = epoch_to_iso(payload.get("event_timestamp"))
    data = payload.get("data")
    if isinstance(data, dict):
        return webhook_type, event_timestamp, data
    return webhook_type, event_timestamp, payload

def extract_transcript_turns(value):
    if not isinstance(value, list):
        return []
    turns = []
    for item in value:
        if not isinstance(item, dict):
            continue
        text = item.get("message") or item.get("text") or item.get("content")
        text = str(text or "").strip()
        if not text:
            continue
        turns.append({
            "role": item.get("role") or item.get("speaker") or "speaker",
            "message": text,
            "time_in_call_secs": item.get("time_in_call_secs"),
        })
    return turns

def extract_dynamic_variables(data: dict) -> dict:
    dynamic_variables = deep_get(data, "conversation_initiation_client_data.dynamic_variables")
    scenario_context = deep_get(data, "conversation_initiation_client_data.scenario_context")
    merged = {}
    if isinstance(dynamic_variables, dict):
        merged.update(dynamic_variables)
    if isinstance(scenario_context, dict):
        merged.update(scenario_context)
    return merged

def storage_signed_url(path: Optional[str], expires_in: int = 60) -> Optional[str]:
    if not path:
        return None
    try:
        response = supabase_admin.storage.from_("call_recordings").create_signed_url(path, expires_in)
        if isinstance(response, dict):
            return response.get("signedURL") or response.get("signed_url") or response.get("signedUrl")
    except Exception as exc:
        logging.warning('main.storage_signed_url.event_5461')
    return None

def upload_call_recording(conversation_id: str, audio_base64: str, *, agent_id: Optional[str] = None) -> Optional[str]:
    if not conversation_id or not audio_base64:
        return None
    if len(audio_base64) > 180 * 1024 * 1024:
        raise HTTPException(413, 'Recording too large')
    try:
        audio_bytes = base64.b64decode(audio_base64, validate=True)
    except (binascii.Error, ValueError) as exc:
        logging.warning('main.upload_call_recording.event_5470')
        return None

    safe_agent_id = sanitize_storage_segment(agent_id, "agent")
    safe_conversation_id = sanitize_storage_segment(conversation_id, uuid4().hex)
    storage_path = f"elevenlabs/{safe_agent_id}/{safe_conversation_id}.mp3"
    from .envelope import seal_file, encryption_required
    tenant = current_tenant.get()
    if not tenant: raise HTTPException(403, 'Trusted recording business required')
    if len(audio_bytes)>128*1024*1024: raise HTTPException(413,'Recording too large')
    if encryption_required(getattr(supabase_admin,'raw',supabase_admin), tenant.business_id):
        storage_path = f"business/{tenant.business_id}/{storage_path}.ndmenc"
        audio_bytes = seal_file(getattr(supabase_admin, 'raw', supabase_admin), audio_bytes,
                                business_id=tenant.business_id, bucket='call_recordings', path=storage_path)
    try:
        supabase_admin.storage.from_("call_recordings").upload(
            storage_path,
            audio_bytes,
            file_options={"content-type": "application/octet-stream" if storage_path.endswith('.ndmenc') else "audio/mpeg", "upsert": "true"},
        )
        return storage_path
    except Exception as exc:
        logging.error('main.upload_call_recording.event_5484')
        return None

def lookup_hired_receptionist(*, hired_receptionist_id=None, elevenlabs_agent_id=None, phone_number=None):
    try:
        if hired_receptionist_id:
            response = (
                supabase.table("hired_receptionists")
                .select("id,user_id,full_name,elevenlabs_voice_id,avatar")
                .eq("id", str(hired_receptionist_id))
                .limit(1)
                .execute()
            )
            if response.data:
                return response.data[0]

        if elevenlabs_agent_id:
            response = (
                supabase.table("hired_receptionists")
                .select("id,user_id,full_name,elevenlabs_voice_id,avatar")
                .eq("elevenlabs_voice_id", str(elevenlabs_agent_id))
                .limit(1)
                .execute()
            )
            if response.data:
                return response.data[0]
    except Exception as exc:
        logging.warning('main.lookup_hired_receptionist.event_5511')
    return None


def extract_agent_data_updates(payload: Optional[dict]) -> dict:
    payload = payload if isinstance(payload, dict) else {}
    dynamic_variables = payload.get("dynamic_variables") if isinstance(payload.get("dynamic_variables"), dict) else {}
    agent_data = payload.get("agent_data") if isinstance(payload.get("agent_data"), dict) else {}
    updates = {**dynamic_variables, **agent_data, **payload}
    return updates


def build_agent_update_map(key: Optional[str], value):
    normalized_key = str(key or "").strip()
    if not normalized_key:
        return {}

    updates = {normalized_key: value}
    # ElevenLabs may submit the UI display label instead of the canonical
    # workflow path. Keep the original key, but add the canonical alias so
    # resumed actions can resolve the same value reliably.
    compact_key = re.sub(r"[^a-z0-9]+", "", normalized_key.lower())
    canonical_aliases = {
        "recservicerecordid": "rec.service.id",
        "servicerecordid": "rec.service.id",
        "recserviceid": "rec.service.id",
        "serviceid": "rec.service.id",
        "recappointmentservice": "rec.service.id",
        "appointmentservice": "rec.service.id",
        "recappointmentserviceid": "rec.appointment.service_id",
        "appointmentserviceid": "rec.appointment.service_id",
        "recstaffrecordid": "rec.staff.id",
        "staffrecordid": "rec.staff.id",
        "recstaffid": "rec.staff.id",
        "staffid": "rec.staff.id",
        "recpersonrecordid": "rec.person.id",
        "personrecordid": "rec.person.id",
        "recpersonid": "rec.person.id",
        "personid": "rec.person.id",
    }
    canonical_key = canonical_aliases.get(compact_key)
    if canonical_key and canonical_key != normalized_key:
        updates.update(build_agent_update_map(canonical_key, value))

    cursor = nested_root = {}
    parts = [part.strip() for part in normalized_key.split(".") if part.strip()]
    if not parts:
        return updates

    for part in parts[:-1]:
        next_cursor = cursor.get(part)
        if not isinstance(next_cursor, dict):
            next_cursor = {}
            cursor[part] = next_cursor
        cursor = next_cursor
    cursor[parts[-1]] = value

    updates.update(nested_root)
    return updates


def build_call_report(flow_context: Optional[dict]) -> Optional[dict]:
    if not isinstance(flow_context, dict):
        return None
    agent_collection = flow_context.get("agent_collection")
    if not isinstance(agent_collection, dict):
        return None

    required_entries = agent_collection.get("required_fields") or []
    collected_entries = agent_collection.get("collected_fields") or []
    missing_entries = agent_collection.get("missing_fields") or []

    def summarize(entries, include_value: bool = False):
        summary = []
        if not isinstance(entries, list):
            return summary
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            item = {
                "label": entry.get("label") or entry.get("preferred_return_key") or entry.get("field"),
                "return_key": entry.get("preferred_return_key") or entry.get("field"),
            }
            if include_value:
                item["value"] = entry.get("value")
            summary.append(item)
        return summary

    return {
        "required_fields": summarize(required_entries, include_value=False),
        "fetched_fields": summarize(collected_entries, include_value=True),
        "missing_fields": summarize(missing_entries, include_value=False),
        "is_complete": bool(agent_collection.get("is_complete")),
    }


def deep_merge_dicts(base: Optional[dict], updates: Optional[dict]) -> dict:
    merged = dict(base or {})
    for key, value in (updates or {}).items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = deep_merge_dicts(merged.get(key), value)
        else:
            merged[key] = value
    return merged

def extract_call_log_from_elevenlabs_payload(payload: dict):
    webhook_type, event_timestamp, data = get_elevenlabs_event_data(payload)
    metadata = data.get("metadata") if isinstance(data.get("metadata"), dict) else {}
    analysis = data.get("analysis") if isinstance(data.get("analysis"), dict) else {}
    initiation_data = data.get("conversation_initiation_client_data") if isinstance(data.get("conversation_initiation_client_data"), dict) else {}
    dynamic_variables = extract_dynamic_variables(data)
    telephony_metadata = data.get("metadata") if webhook_type == "call_initiation_failure" and isinstance(data.get("metadata"), dict) else None
    telephony_body = telephony_metadata.get("body") if isinstance(telephony_metadata, dict) and isinstance(telephony_metadata.get("body"), dict) else {}

    conversation_id = first_present(
        data,
        "conversation_id",
        "metadata.conversation_id",
        "conversation_initiation_client_data.dynamic_variables.system__conversation_id",
    )
    elevenlabs_agent_id = first_present(data, "agent_id", "assistant_id", "metadata.agent_id")
    hired_receptionist_id = first_present(
        data,
        "hired_receptionist_id",
        "metadata.hired_receptionist_id",
        "conversation_initiation_client_data.dynamic_variables.hired_receptionist_id",
        "conversation_initiation_client_data.dynamic_variables.receptionist_id",
    )
    scenario_id = first_present(data, "scenario_id", "metadata.scenario_id", "conversation_initiation_client_data.dynamic_variables.scenario_id")

    from_number = first_present(
        data,
        "from_number",
        "caller_phone",
        "caller.phone_number",
        "customer.phone_number",
        "metadata.phone_call.caller_phone_number",
        "metadata.phone_call.from_number",
        "metadata.phone_call.external_number",
        "conversation_initiation_client_data.dynamic_variables.caller_number",
        "conversation_initiation_client_data.dynamic_variables.from_number",
        "conversation_initiation_client_data.dynamic_variables.system__caller_id",
    ) or first_present(telephony_body, "From", "Caller", "from_number")
    to_number = first_present(
        data,
        "to_number",
        "agent_phone_number",
        "phone_number",
        "metadata.phone_call.agent_number",
        "metadata.phone_call.to_number",
        "conversation_initiation_client_data.dynamic_variables.twilio_to_number",
        "conversation_initiation_client_data.dynamic_variables.to_number",
        "conversation_initiation_client_data.dynamic_variables.system__called_number",
    ) or first_present(telephony_body, "To", "Called", "to_number")
    caller_name = first_present(
        data,
        "caller_name",
        "customer.name",
        "metadata.caller_name",
        "analysis.data_collection_results.caller_name.value",
        "conversation_initiation_client_data.dynamic_variables.caller_name",
        "conversation_initiation_client_data.dynamic_variables.user_name",
    )

    started_at = parse_optional_datetime(
        first_present(data, "started_at", "start_time", "metadata.started_at", "metadata.start_time_unix_secs")
    )
    duration_seconds = first_present(data, "duration_seconds", "metadata.call_duration_secs", "metadata.duration_seconds", "duration")
    try:
        duration_seconds = int(float(duration_seconds)) if duration_seconds is not None else None
    except (TypeError, ValueError):
        duration_seconds = None
    ended_at = parse_optional_datetime(first_present(data, "ended_at", "end_time", "metadata.ended_at"))
    if not ended_at and started_at and duration_seconds is not None:
        ended_at = started_at + timedelta(seconds=duration_seconds)

    transcript_value = data.get("transcript")
    transcript_turns = extract_transcript_turns(transcript_value)
    summary_value = first_present(data, "summary", "analysis.transcript_summary", "analysis.summary", "conversation_summary")
    call_successful = first_present(data, "analysis.call_successful", "call_successful")
    outcome_value = first_present(data, "outcome", "analysis.outcome", "call_outcome", "conversation_initiation_client_data.dynamic_variables.outcome")
    provider_call_sid = first_present(data, "provider_call_sid", "metadata.call_sid", "metadata.phone_call.call_sid") or first_present(telephony_body, "CallSid", "call_sid")
    direction = _extract_call_direction({"raw_payload": payload})

    receptionist = lookup_hired_receptionist(
        hired_receptionist_id=hired_receptionist_id,
        elevenlabs_agent_id=elevenlabs_agent_id,
    )

    return {
        "source": "elevenlabs",
        "webhook_type": webhook_type,
        "event_timestamp": event_timestamp,
        "conversation_id": str(conversation_id) if conversation_id else None,
        "elevenlabs_agent_id": str(elevenlabs_agent_id) if elevenlabs_agent_id else None,
        "agent_name": str(data.get("agent_name")) if data.get("agent_name") else None,
        "hired_receptionist_id": receptionist.get("id") if receptionist else int_or_none(hired_receptionist_id),
        "user_id": receptionist.get("user_id") if receptionist else (str(dynamic_variables.get("user_id")) if dynamic_variables.get("user_id") else None),
        "business_id": int_or_none(dynamic_variables.get("business_id")),
        "receptionist_name": receptionist.get("full_name") if receptionist else (str(data.get("agent_name")) if data.get("agent_name") else None),
        "scenario_id": uuid_or_none(scenario_id),
        "caller_phone": normalize_phone_number(from_number),
        "caller_name": str(caller_name) if caller_name else None,
        "direction": direction,
        "from_number": normalize_phone_number(from_number),
        "to_number": normalize_phone_number(to_number),
        "started_at": started_at.isoformat() if started_at else None,
        "ended_at": ended_at.isoformat() if ended_at else None,
        "duration_seconds": duration_seconds,
        "status": str(data.get("status")) if data.get("status") else ("failed" if webhook_type == "call_initiation_failure" else None),
        "outcome": str(outcome_value) if outcome_value else None,
        "summary": str(summary_value) if summary_value else None,
        "transcript_text": None if transcript_turns else stringify_transcript(transcript_value),
        "transcript_jsonb": transcript_turns or None,
        "branch_id": str(data.get("branch_id")) if data.get("branch_id") else None,
        "version_id": str(data.get("version_id")) if data.get("version_id") else None,
        "environment": str(data.get("environment")) if data.get("environment") else None,
        "has_audio": data.get("has_audio"),
        "has_user_audio": data.get("has_user_audio"),
        "has_response_audio": data.get("has_response_audio"),
        "call_successful": str(call_successful) if call_successful else None,
        "analysis_results": {"call_successful": call_successful},
        "conversation_metadata": event_metadata(metadata),
        "conversation_initiation_data": {"dynamic_variables": event_metadata(dynamic_variables)},
        "telephony_metadata": event_metadata(telephony_metadata),
        "provider_call_sid": str(provider_call_sid) if provider_call_sid else None,
        "failure_reason": str(data.get("failure_reason")) if data.get("failure_reason") else None,
        "raw_payload": event_metadata(payload),
    }

def emit_intent_checkpoint(request: IntentCheckpointRequest):
    normalized_intent_key = normalize_intent_key(request.intent_key)
    if normalized_intent_key not in SUPPORTED_INTENT_KEYS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='The request could not be completed',
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
        "user_id": str(request.user_id) if request.user_id else None,
        "receptionist_id": int_or_none(request.receptionist_id),
        "scenario_id": str(request.scenario_id),
        "intent_key": normalized_intent_key,
        "phase": request.phase,
        "timestamp": checkpoint_ts.isoformat(),
        "conversation_id": payload["conversation_id"],
        "direction": payload["direction"],
        "sid": str(request.call_id) if request.call_id else None,
        "execution_id": payload["execution_id"],
        "session_id": payload["session_id"],
    }

    logging.info('main.emit_intent_checkpoint.event_5907')
    try:
        response = supabase.table("checkpoints").insert(event_record).execute()
    except Exception as exc:
        logging.error('main.emit_intent_checkpoint.event_5792')
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
    user_id: Optional[str] = None,
    business_id: Optional[str] = None,
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
        "user_id": user_id,
        "business_id": business_id,
    }

def insert_payment_record(payment_row: dict):
    try:
        response = supabase.table("payments").insert(payment_row).execute()
        if not response.data:
            raise RuntimeError("Payment record was not persisted")
        saved = response.data[0]
        claim_payment_milestones(supabase, saved)
        return saved
    except Exception as exc:
        logging.error('main.insert_payment_record.event_5843')
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Payment was created externally but could not be recorded locally.",
        ) from exc

def update_payment_record(match_field: str, match_value: str, update_data: dict, user_id: Optional[str] = None):
    query = supabase.table("payments").update(update_data).eq(match_field, match_value)
    if user_id:
        query = query.eq("user_id", user_id)
    response = query.execute()
    saved = response.data[0] if response.data else None
    if not saved:
        refreshed_query = supabase.table("payments").select("*").eq(match_field, match_value)
        if user_id:
            refreshed_query = refreshed_query.eq("user_id", user_id)
        refreshed = refreshed_query.limit(1).execute()
        saved = refreshed.data[0] if refreshed.data else None
    if saved:
        claim_payment_milestones(supabase, saved)
    return saved


def is_uuid_value(value: Optional[str]) -> bool:
    try:
        UUID(str(value))
        return True
    except (TypeError, ValueError, AttributeError):
        return False


def normalize_payment_record_status(value: Optional[str], fallback: str = "pending") -> str:
    normalized = str(value or "").strip().lower()
    if not normalized:
        return fallback
    status_map = {
        "paid": "succeeded",
        "complete": "succeeded",
        "completed": "succeeded",
        "succeeded": "succeeded",
        "pending": "pending",
        "unpaid": "pending",
        "open": "pending",
        "failed": "failed",
        "error": "failed",
        "declined": "failed",
        "refunded": "refunded",
        "partial_refund": "partial_refund",
        "partial_refunded": "partial_refund",
    }
    return status_map.get(normalized, normalized)

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
        update_data["status"] = normalize_payment_record_status(status)
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
    return {"status": "ok", "message": "Welcome to the Nodemere API"}

@app.get("/config/status", response_model=ConfigStatusResponse, tags=["Config"])
async def get_config_status():
    """Returns the current configuration status, like TEST_MODE."""
    return {"test_mode": TEST_MODE}


def ensure_inbound_verification_tool(payload: dict) -> None:
    """Keep verification tools scoped to the inbound agent when identifiable."""
    direction = str(first_present(payload, "direction", "call_direction") or "").strip().lower()
    agent_id = first_present(
        payload,
        "agent_id",
        "elevenlabs_agent_id",
        "metadata.agent_id",
        "system__agent_id",
        "system_agent_id",
    )
    if direction in {"outbound", "outgoing"} or (
        agent_id and elevenlabs_agent_id_outbound and str(agent_id) == str(elevenlabs_agent_id_outbound)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Verification tools are available to the inbound agent only.",
        )


def build_verification_request_context(payload: dict) -> dict:
    ensure_inbound_verification_tool(payload)
    context = resolve_business_context(payload)
    business = context.get("business") or {}
    business_id = business.get("id") or first_present(payload, "business_id")
    phone = normalize_phone_number(first_present(
        payload,
        "phone",
        "caller_number",
        "caller_phone",
        "from_number",
        "system__caller_id",
        "system_caller_id",
        "From",
    ))
    person_id = context.get("person_id") or first_present(payload, "person_id", "record_id", "customer_id")
    if not person_id and phone:
        matched_person = lookup_person_record(
            phone_number=phone,
            business_id=str(business_id) if business_id is not None else None,
            user_id=context.get("user_id") or business.get("user_id"),
        )
        if matched_person:
            person_id = matched_person.get("id")
            business_id = business_id or matched_person.get("business_id")
    receptionist_id = first_present(
        payload,
        "hired_receptionist_id",
        "receptionist_id",
        "system__receptionist_id",
        "system_receptionist_id",
        "metadata.hired_receptionist_id",
        "metadata.receptionist_id",
    )
    if not receptionist_id and business_id:
        assigned_receptionist = find_inbound_receptionist_for_business(
            business_id,
            context.get("user_id") or business.get("user_id"),
        )
        receptionist_id = (assigned_receptionist or {}).get("id")
    return {
        "business_id": business_id,
        "person_id": person_id,
        "phone": phone,
        "user_id": context.get("user_id") or business.get("user_id") or first_present(payload, "user_id"),
        "metadata": {
            "source": "inbound_agent",
            "direction": "inbound",
            "conversation_id": first_present(payload, "conversation_id", "system__conversation_id", "system_conversation_id"),
            "call_id": first_present(payload, "call_id", "CallSid", "callSid"),
            "agent_id": first_present(payload, "agent_id", "elevenlabs_agent_id"),
            "hired_receptionist_id": receptionist_id,
            **(payload.get("metadata") if isinstance(payload.get("metadata"), dict) else {}),
        },
    }


def _system_gmail_configuration() -> SystemGmailConfiguration:
    return SystemGmailConfiguration(
        sender_email=system_gmail_sender_email,
        refresh_token=system_gmail_refresh_token,
        google_client_id=google_client_id,
        google_client_secret=google_client_secret,
    )


def _customer_email_for_secure_link(context: dict) -> Optional[str]:
    """Resolve the delivery recipient from the existing customer record only."""
    person_id = context.get("person_id")
    if not person_id:
        return None
    person = lookup_person_record(
        person_id=str(person_id),
        business_id=str(context["business_id"]) if context.get("business_id") is not None else None,
        user_id=context.get("user_id"),
    )
    return str((person or {}).get("email") or "").strip() or None


def _business_name_for_secure_link(payload: dict, context: dict) -> Optional[str]:
    resolved = resolve_business_context(payload)
    business = resolved.get("business") or {}
    if not business and context.get("business_id") is not None:
        business = load_business_by_id(str(context["business_id"])) or {}
    name = str(business.get("name") or "").strip()
    return name or None


def _secure_link_delivery_failure(
    *,
    request_result: dict,
    code: str,
    message: str,
    missing_configuration: tuple[str, ...] = (),
) -> dict:
    """Return the existing request identifiers without leaking its raw token."""
    delivery = {
        "success": False,
        "status": "failed",
        "channel": "email",
        "code": code,
    }
    if missing_configuration:
        delivery["missing_configuration"] = list(missing_configuration)
    return {
        "success": False,
        "status": "delivery_failed",
        "message": message,
        "request_id": request_result.get("request_id"),
        "session_id": request_result.get("session_id"),
        "request_type": request_result.get("request_type"),
        "expires_at": request_result.get("expires_at"),
        "delivery": delivery,
    }


def deliver_existing_secure_link_by_email(
    *,
    request_result: dict,
    context: dict,
    payload: dict,
    kind: Literal["verification", "document_upload"],
) -> dict:
    """Deliver a pre-generated request URL without changing its lifecycle."""
    link_key = "verification_url" if kind == "verification" else "request_url"
    secure_link = request_result.get(link_key)
    if not secure_link:
        return _secure_link_delivery_failure(
            request_result=request_result,
            code="secure_link_missing",
            message="The secure link could not be prepared for email delivery.",
        )

    business_name = _business_name_for_secure_link(payload, context)
    if not business_name:
        return _secure_link_delivery_failure(
            request_result=request_result,
            code="business_name_missing",
            message="The secure link could not be emailed because the business is unavailable.",
        )

    recipient_email = _customer_email_for_secure_link(context)
    if not recipient_email:
        return _secure_link_delivery_failure(
            request_result=request_result,
            code="customer_email_missing",
            message="The caller does not have an email address on file.",
        )

    try:
        delivery = send_secure_link_email(
            kind=kind,
            recipient_email=recipient_email,
            business_name=business_name,
            secure_link=str(secure_link),
            configuration=_system_gmail_configuration(),
        )
    except EmailDeliveryError as exc:
        log_email_delivery_failure(
            kind=kind,
            request_id=request_result.get("request_id"),
            business_id=context.get("business_id"),
            error=exc,
        )
        return _secure_link_delivery_failure(
            request_result=request_result,
            code=exc.code,
            message=exc.message,
            missing_configuration=exc.missing_configuration,
        )
    except requests.RequestException:
        logging.warning('main.deliver_existing_secure_link_by_email.event_6136')
        return _secure_link_delivery_failure(
            request_result=request_result,
            code="email_provider_unavailable",
            message="The email provider could not be reached. Please try again.",
        )
    except Exception:
        logging.exception('main.deliver_existing_secure_link_by_email.event_6148')
        return _secure_link_delivery_failure(
            request_result=request_result,
            code="email_delivery_failed",
            message="The secure link could not be emailed. Please try again.",
        )

    # The generated URL contains the one-time token. It is passed directly to
    # Gmail, but intentionally omitted from the receptionist/tool response.
    return {
        "success": True,
        "request_id": request_result.get("request_id"),
        "session_id": request_result.get("session_id"),
        "request_type": request_result.get("request_type"),
        "status": request_result.get("status"),
        "expires_at": request_result.get("expires_at"),
        "delivery": delivery,
    }


async def check_verification_status_tool(request: Request):
    payload = await parse_request_payload(request)
    context = build_verification_request_context(payload)
    if not caller_authentication_allowed(user_id=context.get("user_id"), business_id=context.get("business_id")):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Caller authentication is disabled in account preferences.",
        )
    token = first_present(payload, "token", "verification_token")
    session_id = first_present(payload, "session_id", "verification_session_id")
    if not token and not session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="token or session_id is required",
        )
    return get_verification_status(
        supabase_admin,
        token=token,
        session_id=session_id,
        business_id=context.get("business_id"),
    )


async def request_document_upload_tool(request: Request):
    payload = await parse_request_payload(request)
    context = build_verification_request_context(payload)
    if context.get("business_id") is None or context.get("person_id") is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A matching business and person are required before requesting a document upload.",
        )
    request_result = create_document_request(supabase_admin, base_url=verification_base_url, **context)
    return deliver_existing_secure_link_by_email(
        request_result=request_result,
        context=context,
        payload=payload,
        kind="document_upload",
    )


async def check_document_upload_status_tool(request: Request):
    payload = await parse_request_payload(request)
    context = build_verification_request_context(payload)
    token = first_present(payload, "token", "document_token", "request_token")
    request_id = first_present(payload, "request_id", "document_request_id", "session_id")
    if not token and not request_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="token or request_id is required",
        )
    return get_document_request_status(
        supabase_admin,
        token=token,
        request_id=request_id,
        business_id=context.get("business_id"),
    )


class ContractCreateRequest(BaseModel):
    signer_name: Optional[str] = None
    signer_email: Optional[EmailStr] = None
    voice_display_name: Optional[str] = None
    business_id: Optional[int] = None
    person_id: Optional[int] = None
    user_id: Optional[str] = None
    metadata: Optional[dict] = None


class ContractSignRequest(BaseModel):
    signer_name: str = Field(..., min_length=1, max_length=160)
    signer_email: EmailStr
    signature_data_url: str
    consent: Optional[dict] = None


class ContractConsentRequest(BaseModel):
    consent_key: str = Field(..., pattern="^(voice|identity|usage)$")


def get_client_ip(request: Request) -> Optional[str]:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else None


@app.post("/api/contracts", tags=["Voice Contracts"])
async def create_voice_contract(payload: ContractCreateRequest, current_user: dict = Depends(get_current_user)):
    current_user_id = business_owner_id(current_user)
    business = load_business_by_user_id(current_user_id)
    if not business:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    if payload.business_id and str(payload.business_id) != str(business.get("id")):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot create a contract for another business.")
    return create_contract(
        supabase_admin,
        base_url=verification_base_url,
        signer_name=payload.signer_name or "",
        signer_email=str(payload.signer_email or ""),
        voice_display_name=payload.voice_display_name or "",
        business_id=business.get("id"),
        person_id=payload.person_id,
        user_id=current_user_id,
        metadata=payload.metadata or {},
    )


@app.post("/api/tools/create-contract-link", tags=["Server Tools"])
@app.post("/api/tools/request-contract", tags=["Server Tools"])
async def create_voice_contract_tool(request: Request, _internal: None = Depends(require_internal_tool_authorization)):
    payload = await parse_request_payload(request)
    context = build_verification_request_context(payload)
    metadata = first_present(payload, "metadata") or {}
    if not isinstance(metadata, dict):
        metadata = {}
    business = context.get("business") or {}
    if business.get("name") and not metadata.get("business_name"):
        metadata["business_name"] = business.get("name")
    return create_contract(
        supabase_admin,
        base_url=verification_base_url,
        signer_name=first_present(payload, "signer_name", "name", "full_name") or "",
        signer_email=first_present(payload, "signer_email", "email") or "",
        voice_display_name=first_present(payload, "voice_display_name", "voice_name") or "",
        business_id=context.get("business_id"),
        person_id=context.get("person_id"),
        user_id=context.get("user_id"),
        metadata=metadata,
    )


@app.get("/api/contracts/{token}", tags=["Voice Contracts"])
async def get_voice_contract_state(token: str):
    return get_contract_public_state(supabase_admin, token)


@app.post("/api/contracts/{token}/sign", tags=["Voice Contracts"])
async def sign_voice_contract(token: str, payload: ContractSignRequest, request: Request):
    result = sign_contract(
        supabase_admin,
        token=token,
        signer_name=payload.signer_name,
        signer_email=str(payload.signer_email),
        signature_data_url=payload.signature_data_url,
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
        consent=payload.consent or {},
    )
    if not result.get("success"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='The request could not be completed')
    return result


@app.post("/api/contracts/{token}/consents", tags=["Voice Contracts"])
async def accept_voice_contract_consent(token: str, payload: ContractConsentRequest, request: Request):
    result = record_checkbox_consent(
        supabase_admin,
        token=token,
        consent_key=payload.consent_key,
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    if not result.get("success"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='The request could not be completed')
    return result


@app.get("/api/contracts/{token}/clone", tags=["Voice Contracts"])
async def get_voice_clone_state(token: str):
    result = get_contract_public_state(supabase_admin, token)
    if not result.get("success"):
        return result
    if result.get("status") not in {"signed", "cloned"}:
        return {**result, "clone_ready": False, "message": "Sign the agreement before cloning your voice."}
    return {**result, "clone_ready": True}


@app.post("/api/contracts/{token}/clone", tags=["Voice Contracts"])
async def create_instant_voice_clone(token: str, request: Request):
    try:
        contract=get_contract_public_state(supabase_admin,token)
        if not contract.get('success') or contract.get('status') not in {'signed','cloned'}:
            raise HTTPException(403,'This voice upload link is unavailable')
        form = await request.form(max_files=6,max_fields=3)
        voice_name = str(form.get("voice_name") or "").strip()
        remove_background_noise = str(form.get("remove_background_noise") or "true").lower() in {"1", "true", "yes", "on"}
        raw_files = form.getlist("files")
        uploaded_files = []
        for uploaded in raw_files:
            if uploaded is None or not hasattr(uploaded, "read"):
                continue
            try:
                content = await uploaded.read(25*1024*1024+1)
            finally:
                await uploaded.close()
            uploaded_files.append(SimpleNamespace(
                filename=getattr(uploaded, "filename", "sample.webm"),
                content_type=getattr(uploaded, "content_type", None),
                content=content,
            ))
        result = clone_voice(
            supabase_admin,
            token=token,
            api_key=elevenlabs_api_key,
            voice_name=voice_name,
            uploaded_files=uploaded_files,
            remove_background_noise=remove_background_noise,
        )
        if not result.get("success"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='The request could not be completed')
        return result
    except HTTPException:
        raise
    except Exception as exc:
        logging.error('main.create_instant_voice_clone.event_6381')
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"message": "Voice cloning failed. Please try again."}) from exc


@app.post("/api/contracts/{token}/receptionist-profile", tags=["Voice Contracts"])
async def complete_cloned_receptionist_profile(
    token: str,
    first_name: str = Form(...),
    last_name: str = Form(...),
    age: str = Form(...),
    description: str = Form(...),
    traits: str = Form(...),
    image: Optional[UploadFile] = File(None),
):
    try:
        contract=get_contract_public_state(supabase_admin,token)
        if not contract.get('success') or contract.get('status') not in {'signed','cloned'}:
            raise HTTPException(403,'This profile link is unavailable')
        content = await image.read(5*1024*1024+1) if image else None
        result = save_cloned_receptionist_profile(
            supabase_admin,
            token=token,
            first_name=first_name,
            last_name=last_name,
            age=age,
            description=description,
            traits=traits,
            image_filename=getattr(image, "filename", None),
            image_content_type=getattr(image, "content_type", None),
            image_content=content,
        )
        if not result.get("success"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='The request could not be completed')
        return result
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"message": "Invalid profile data"}) from exc
    except Exception as exc:
        logging.error('main.complete_cloned_receptionist_profile.event_6417')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail={"message": "Could not save the cloned receptionist."}) from exc


@app.get("/api/upload/{token}", tags=["Document Upload"])
async def get_document_upload_state(token: str):
    return get_document_request(supabase_admin, token)


@app.post("/api/upload/{token}/files", tags=["Document Upload"])
async def upload_document_file(token: str, request: Request):
    uploaded = None
    try:
        state = get_document_request(supabase_admin, token)
        if not state.get("success") or state.get("status") != "pending":
            raise HTTPException(403, "This upload link is unavailable")
        form = await request.form(max_files=1, max_fields=2)
        uploaded = form.get("file")
        if uploaded is None or not hasattr(uploaded, "read"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="file is required")
        notice_accepted = str(form.get("acknowledged") or "").strip().lower() in {"1", "true", "yes", "on"}
        content = await uploaded.read(10 * 1024 * 1024 + 1)
        result = store_document(
            supabase_admin,
            token=token,
            filename=getattr(uploaded, "filename", "document"),
            content_type=getattr(uploaded, "content_type", None),
            content=content,
            notice_accepted=notice_accepted,
        )
        if not result.get("success"):
            detail = {"message": result.get("message") or "Upload failed", "status": result.get("status")}
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='The request could not be completed')
        return result
    except HTTPException:
        raise
    except Exception as exc:
        logging.error('main.upload_document_file.event_6452')
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Upload failed") from exc
    finally:
        if uploaded is not None and hasattr(uploaded,"close"):
            await uploaded.close()


@app.get("/api/verification/{token}", tags=["Verification"])
async def get_verification_page_state(token: str):
    return get_public_verification(supabase_admin, token)


@app.post("/api/verification/{token}/complete", tags=["Verification"])
async def complete_verification_page(token: str):
    return complete_verification(supabase_admin, token)


@app.post("/api/tools/request_docs", tags=["Server Tools"])
@app.post("/api/tools/request-docs", tags=["Server Tools"])
@app.post("/api/tools/document_request", tags=["Server Tools"])
@app.post("/api/tools/document-request", tags=["Server Tools"])
async def request_document_upload_route(request: Request, _internal: None = Depends(require_internal_tool_authorization)):
    return await request_document_upload_tool(request)


@app.post("/api/tools/get_docs", tags=["Server Tools"])
@app.post("/api/tools/get-docs", tags=["Server Tools"])
@app.post("/api/tools/document_verify", tags=["Server Tools"])
@app.post("/api/tools/document-verify", tags=["Server Tools"])
async def verify_document_upload_route(request: Request, _internal: None = Depends(require_internal_tool_authorization)):
    return await check_document_upload_status_tool(request)


@app.post("/api/tools/check-verification-status", tags=["Server Tools"])
async def check_verification_status_route(request: Request, _internal: None = Depends(require_internal_tool_authorization)):
    return await check_verification_status_tool(request)


@app.post("/api/tools/check-authentication", tags=["Server Tools"])
@app.post("/api/tools/check_authentication", tags=["Server Tools"])
@app.post("/api/tools/verify-authentication", tags=["Server Tools"])
@app.post("/api/tools/verify_authentication", tags=["Server Tools"])
@app.post("/api/tools/auth-verify", tags=["Server Tools"])
@app.post("/api/tools/auth_verify", tags=["Server Tools"])
async def check_authentication_route(request: Request, _internal: None = Depends(require_internal_tool_authorization)):
    return await check_verification_status_tool(request)

def scenario_belongs_to_user(scenario: dict, user_id: str) -> bool:
    owner = scenario.get("user_id") or scenario.get("created_by")
    return bool(owner) and str(owner) == str(user_id)


def normalize_scenario_json_fields(payload: dict) -> dict:
    normalized = dict(payload or {})
    for field in ("nodes_data", "edges_data"):
        if field not in normalized:
            continue
        value = normalized.get(field)
        if value is None:
            continue
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except Exception as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={field: f"Invalid JSON: {exc}"},
                ) from exc
        if not isinstance(value, list):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={field: "Must be a list"},
            )
        normalized[field] = value
    return normalized


PAYMENT_SCENARIO_FEATURE_KEYS = {
    "create_customer",
    "update_customer",
    "create_payment",
    "send_payment_link",
    "create_invoice",
    "send_invoice",
    "refund_payment",
    "cancel_subscription",
    "update_payment",
    "check_payment_status",
    "issue_refund",
    "payment_received",
    "payment_failed",
    "refund_issued",
    "subscription_created",
}


def scenario_uses_payment_features(payload: dict) -> bool:
    for node in (payload or {}).get("nodes_data") or []:
        if not isinstance(node, dict):
            continue
        action_config = node.get("actionConfig") or {}
        key = node.get("subOptionKey") or action_config.get("_key")
        if key in PAYMENT_SCENARIO_FEATURE_KEYS:
            return True
    return False


def require_scenario_feature_access(user_id: str, scenario: dict, *, direction: str = "scenario") -> dict:
    context = require_plan_access(user_id, direction)
    if scenario_uses_payment_features(scenario):
        require_payment_access(user_id)
    return context


def validate_scenario_if_active(payload: dict):
    status_value = str((payload or {}).get("status") or "").lower()
    is_active = (payload or {}).get("is_active") is True or status_value == "active"
    if not is_active:
        return
    definition_errors = validate_scenario_definition(payload or {})
    if definition_errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "Scenario configuration is invalid", "errors": definition_errors},
        )


def execution_belongs_to_user(execution: dict, user_id: str) -> bool:
    if str(execution.get("user_id") or "") == str(user_id):
        return True
    flow_context = execution.get("flow_context") or {}
    if isinstance(flow_context, str):
        try:
            flow_context = json.loads(flow_context)
        except Exception:
            flow_context = {}
    if not isinstance(flow_context, dict):
        return False
    context_owner = flow_context.get("user_id") or (flow_context.get("business") or {}).get("user_id")
    return bool(context_owner) and str(context_owner) == str(user_id)


def build_authenticated_scenario_event_payload(payload: Optional[dict], current_user_id: str) -> dict:
    business = require_business_for_user(current_user_id)
    event_payload = dict(payload or {})
    # Browser-supplied snapshots are not authoritative database records. Keep
    # identifiers/ordinary trigger fields; the engine hydrates scoped records.
    for key in ("business", "person", "people", "record", "customer", "appointment",
                "appointments", "staff", "payment", "payments", "invoice", "invoices",
                "receptionist", "agent", "subscription"):
        event_payload.pop(key, None)
    event_payload = {key: value for key, value in event_payload.items() if not key.startswith("_")}
    event_payload["user_id"] = current_user_id
    if business and business.get("id") is not None:
        event_payload["business_id"] = business.get("id")
        event_payload["business"] = business
    return event_payload


@app.post("/api/scenarios/trigger", tags=["Scenarios"])
async def trigger_scenario(request: ScenarioTriggerRequest, current_user: dict = Depends(get_current_user)):
    return emit_scenario_trigger(
        request.trigger_key,
        build_authenticated_scenario_event_payload(request.payload, business_owner_id(current_user)),
        request.created_at,
    )


@app.get("/api/sonar/scenarios", tags=["Sonar Scenarios"])
async def list_sonar_scenarios(current_user: dict = Depends(get_current_user)):
    user_id = business_owner_id(current_user)
    response = (
        supabase_admin.table("scenarios")
        .select("*")
        .or_(f"user_id.eq.{user_id},created_by.eq.{user_id}")
        .order("updated_at", desc=True)
        .execute()
    )
    return response.data or []


@app.post("/api/sonar/scenarios", tags=["Sonar Scenarios"])
async def create_sonar_scenario(payload: dict, current_user: dict = Depends(get_current_user)):
    user_id = business_owner_id(current_user)
    context = require_plan_access(user_id, "scenarios")
    existing_count = count_user_rows("scenarios", user_id)
    enforce_plan_limit(context, "scenarios", existing_count, "max_scenarios")
    insert_payload = normalize_scenario_json_fields(payload or {})
    from .permissions import contains_privileged_scenario_action
    if contains_privileged_scenario_action(insert_payload):
        require_permission(current_tenant.get(), 'billing.change')
    if not insert_payload.get("id"):
        insert_payload["id"] = str(uuid4())
    if scenario_uses_payment_features(insert_payload):
        require_payment_access(user_id)
    insert_payload["user_id"] = user_id
    insert_payload["created_by"] = user_id
    business = load_business_by_user_id(user_id)
    insert_payload["business_id"] = (business or {}).get("id")
    validate_scenario_if_active(insert_payload)
    response = supabase_admin.table("scenarios").insert(insert_payload).execute()
    if not response.data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Scenario could not be created")
    claim_nest_milestone(
        supabase_admin,
        business_id=insert_payload.get("business_id"),
        user_id=user_id,
        milestone_key="first_scenario_created",
        title="First scenario created",
        message=str(insert_payload.get("name") or ""),
        source_id=insert_payload.get("id"),
    )
    if scenario_engine:
        await scenario_engine.load_scenarios()
    return response.data[0]


@app.put("/api/sonar/scenarios/{scenario_id}", tags=["Sonar Scenarios"])
async def update_sonar_scenario(scenario_id: str, payload: dict, current_user: dict = Depends(get_current_user)):
    user_id = business_owner_id(current_user)
    require_plan_access(user_id, "scenarios")
    existing_response = (
        supabase_admin.table("scenarios")
        .select("*")
        .eq("id", scenario_id)
        .or_(f"user_id.eq.{user_id},created_by.eq.{user_id}")
        .limit(1)
        .execute()
    )
    if not existing_response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scenario not found")
    updates = {key: value for key, value in normalize_scenario_json_fields(payload or {}).items() if key not in {"id", "user_id", "created_by", "business_id", "created_at"}}
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    existing_scenario = normalize_scenario_json_fields(existing_response.data[0])
    next_scenario = {**existing_scenario, **updates}
    from .permissions import contains_privileged_scenario_action
    if contains_privileged_scenario_action(existing_scenario) or contains_privileged_scenario_action(next_scenario):
        require_permission(current_tenant.get(), 'billing.change')
    if scenario_uses_payment_features(next_scenario):
        require_payment_access(user_id)
    validate_scenario_if_active(next_scenario)
    response = (
        supabase_admin.table("scenarios")
        .update(updates)
        .eq("id", scenario_id)
        .or_(f"user_id.eq.{user_id},created_by.eq.{user_id}")
        .execute()
    )
    if scenario_engine:
        await scenario_engine.load_scenarios()
    return (response.data or [{**existing_response.data[0], **updates}])[0]


@app.delete("/api/sonar/scenarios/{scenario_id}", tags=["Sonar Scenarios"])
async def delete_sonar_scenario(scenario_id: str, current_user: dict = Depends(get_current_user)):
    user_id = business_owner_id(current_user)
    require_plan_access(user_id, "scenarios")
    response = (
        supabase_admin.table("scenarios")
        .delete()
        .eq("id", scenario_id)
        .or_(f"user_id.eq.{user_id},created_by.eq.{user_id}")
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scenario not found")
    if scenario_engine:
        await scenario_engine.load_scenarios()
    return {"ok": True, "id": scenario_id}

@app.post("/api/trigger-scenario", tags=["Scenarios"])
async def trigger_scenario_legacy_alias(request: ScenarioTriggerRequest, current_user: dict = Depends(get_current_user)):
    return emit_scenario_trigger(
        request.trigger_key,
        build_authenticated_scenario_event_payload(request.payload, business_owner_id(current_user)),
        request.created_at,
    )

@app.post("/api/scenarios/trigger/{scenario_id}", tags=["Scenarios"])
async def trigger_specific_scenario(scenario_id: str, payload: dict, current_user: dict = Depends(get_current_user)):
    if not scenario_engine:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Scenario engine unavailable")
    require_plan_access(business_owner_id(current_user), "scenarios")
    scenario_response = scenario_engine.supabase.table("scenarios").select("id,user_id,created_by").eq("id", scenario_id).limit(1).execute()
    scenario = (scenario_response.data or [None])[0]
    if not scenario or not scenario_belongs_to_user(scenario, business_owner_id(current_user)):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scenario not found")
    result = await scenario_engine.trigger_scenario(
        scenario_id,
        build_authenticated_scenario_event_payload(payload, business_owner_id(current_user)),
    )
    if not result.get("ok"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='The request could not be completed')
    return result

@app.post("/api/scenarios/run-builder", tags=["Scenarios"])
async def run_builder_scenario(payload: dict, current_user: dict = Depends(get_current_user)):
    if not scenario_engine:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Scenario engine unavailable")

    scenario = payload.get("scenario")
    if not isinstance(scenario, dict):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="scenario payload required")

    nodes_data = scenario.get("nodes_data")
    if isinstance(nodes_data, str):
        try:
            nodes_data = json.loads(nodes_data)
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='The request could not be completed') from exc
    if not isinstance(nodes_data, list) or not nodes_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="scenario.nodes_data required")

    user_id = business_owner_id(current_user)
    require_plan_access(user_id, "scenarios")
    business = require_business_for_user(user_id)
    # The builder payload is untrusted input. Always bind a test run to the
    # authenticated tenant instead of accepting user/business IDs supplied in
    # imported JSON or by a caller.
    scenario["user_id"] = user_id
    scenario["created_by"] = user_id
    scenario["business_id"] = business.get("id") if business else None
    scenario["nodes_data"] = nodes_data

    definition_errors = validate_scenario_definition(scenario)
    if definition_errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "Scenario configuration is invalid", "errors": definition_errors},
        )

    event_type = str(payload.get("event_type") or "manual_trigger")
    event_payload = build_authenticated_scenario_event_payload(
        payload.get("payload") if isinstance(payload.get("payload"), dict) else {}, user_id
    )

    trigger_node = next((node for node in nodes_data if (node or {}).get("categoryType") == "TRIGGERS" and (node or {}).get("configured")), None)
    if not trigger_node:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Scenario must contain a trigger node")

    flow_context = await scenario_engine._build_flow_context(scenario, event_type, event_payload)
    result = await scenario_engine.flow_executor.start(
        scenario,
        {"event_type": event_type, "payload": event_payload},
        flow_context=flow_context,
        trigger_node_id=trigger_node.get("id"),
        persist_execution=False,
    )
    execution_id = (
        result.get("executionId")
        or result.get("execution_id")
        or ((result.get("context") or {}).get("_executionId") if isinstance(result.get("context"), dict) else None)
        or flow_context.get("_executionId")
    )
    return {"ok": True, "execution_id": execution_id, "result": result}

@app.post("/api/scenarios/resume", tags=["Scenarios"])
async def resume_scenario_execution(payload: dict, _internal: None = Depends(require_internal_tool_authorization)):
    if not scenario_engine:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Scenario engine unavailable")
    execution_id = first_present(payload, "execution_id", "flow_execution_id", "id")
    if not execution_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="execution_id or flow_execution_id required")
    agent_payload = payload.get("agent_data") or payload.get("agent") or {}
    call_payload = {
        "call_sid": payload.get("call_sid"),
        "call_outcome": payload.get("call_outcome"),
    }
    existing_execution = await scenario_engine.get_execution(str(execution_id))
    if not existing_execution:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='The request could not be completed')

    current_context = existing_execution.get("flow_context")
    if isinstance(current_context, str):
        try:
            current_context = json.loads(current_context)
        except Exception:
            current_context = {}
    current_context = current_context if isinstance(current_context, dict) else {}
    if isinstance(agent_payload, dict):
        current_context["agent"] = deep_merge_dicts(current_context.get("agent"), agent_payload)
    current_context.update({k: v for k, v in call_payload.items() if v is not None})
    execution_status = str(existing_execution.get("status") or "").lower()
    supabase.table("flow_executions").update({
        "flow_context": workflow_snapshot(current_context, terminal=execution_status in {'completed','failed'}),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", str(execution_id)).execute()

    if execution_status != "paused":
        return {
            "ok": True,
            "mode": "execution_context_update",
            "execution_id": str(execution_id),
            "status": execution_status or None,
        }

    resume_payload = {
        "agent": current_context.get("agent") or {},
        "call": call_payload,
    }
    result = await scenario_engine.resume_execution(str(execution_id), resume_payload)
    if result.get("success"):
        return {"ok": True, **result}
    detail = result.get("error") or "Resume failed"
    if "not found" in str(detail).lower():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='The request could not be completed')
    if "not paused" in str(detail).lower():
        return {
            "ok": True,
            "mode": "execution_context_update",
            "execution_id": str(execution_id),
            "status": execution_status or None,
        }
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='The request could not be completed')

@app.get("/api/scenarios/executions", tags=["Scenarios"])
async def list_scenario_executions(limit: int = 20, current_user: dict = Depends(get_current_user)):
    if not scenario_engine:
        return []
    executions = await scenario_engine.list_executions(max(1, min(limit, 100)))
    return [execution for execution in executions if execution_belongs_to_user(execution, business_owner_id(current_user))]

@app.get("/api/scenarios/executions/{execution_id}", tags=["Scenarios"])
async def get_scenario_execution(execution_id: str, current_user: dict = Depends(get_current_user)):
    if not scenario_engine:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Scenario engine unavailable")
    execution = await scenario_engine.get_execution(execution_id)
    if not execution or not execution_belongs_to_user(execution, business_owner_id(current_user)):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Execution not found")
    return execution_progress(execution)

@app.post("/api/scenarios/reload", tags=["Scenarios"])
async def reload_scenarios(current_user: dict = Depends(get_current_user)):
    if not scenario_engine:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Scenario engine unavailable")
    scenarios = await scenario_engine.load_scenarios()
    return {"ok": True, "count": sum(str(s.get('business_id')) == str(current_tenant.get().business_id) for s in scenarios)}

@app.post("/twilio/inbound", tags=["Twilio"])
async def twilio_inbound_webhook(request: Request):
    await verify_twilio_webhook_request(request, twilio_voice_webhook_url)
    payload = await parse_request_payload(request)
    from_number = normalize_phone_number(first_present(payload, "From", "from", "from_number", "Caller", "caller"))
    to_number = normalize_phone_number(first_present(payload, "To", "to", "to_number", "Called", "called"))

    if not elevenlabs_api_key or not elevenlabs_agent_id_inbound:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ElevenLabs inbound calling is not configured.",
        )
    if not from_number or not to_number:
        logging.error('main.twilio_inbound_webhook.event_6926')
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Twilio inbound webhook requires From and To numbers.",
        )

    context = resolve_business_context({
        "from_number": from_number,
        "to_number": to_number,
        "forwarded_from": first_present(payload, "ForwardedFrom", "forwarded_from"),
    })
    business = context.get("business")
    resolved_user_id = context.get("user_id") or (business or {}).get("user_id")
    if not business or not resolved_user_id:
        raise HTTPException(403,'Called number is not assigned to an active business')
    from .authorization import scenario_tenant, tenant_scope
    call_tenant=scenario_tenant(getattr(supabase_admin,'raw',supabase_admin), {'business_id':business['id'],'user_id':resolved_user_id})
    inbound_open, inbound_reason = is_business_call_window_open(business, layer="inbound")
    if not inbound_open:
        logging.info('main.twilio_inbound_webhook.event_6945')
        return Response(
            content="<Response><Say>Our receptionist is unavailable right now. Please call back during our available hours.</Say><Hangup/></Response>",
            media_type="application/xml",
        )
    try:
        enforce_call_minutes(str(resolved_user_id or ""), business, direction="inbound")
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, dict) else {}
        logging.warning('main.twilio_inbound_webhook.event_6917')
        return Response(
            content="<Response><Say>We are unable to connect this call right now. Please contact the account owner.</Say><Hangup/></Response>",
            media_type="application/xml",
        )
    receptionist = find_inbound_receptionist_for_business(
        business.get("id") if business else None,
        context.get("user_id") or (business or {}).get("user_id"),
    )
    required_opening = build_inbound_ai_disclosure(
        business.get("name") if business else None,
        get_receptionist_display_name(receptionist),
    )
    maybe_auto_verify_business_forwarding(business, called_number=to_number)

    event_payload = {
        "trigger_key": "incoming_call",
        "call_id": first_present(payload, "CallSid"),
        "from_number": from_number,
        "to_number": to_number,
        "forwarded_from": normalize_phone_number(first_present(payload, "ForwardedFrom", "forwarded_from")),
        "direction": "inbound",
        "provider": "twilio",
        "received_at": datetime.now(timezone.utc).isoformat(),
        "user_id": context.get("user_id"),
        "business_id": business.get("id") if business else None,
        "business_name": business.get("name") if business else None,
        "receptionist_id": receptionist.get("id") if receptionist else None,
        "receptionist_name": get_receptionist_display_name(receptionist),
    }
    emit_scenario_trigger("incoming_call", event_payload)
    with tenant_scope(call_tenant):
        upsert_active_call_log(event_payload,user_id=resolved_user_id,business_id=business['id'],receptionist=receptionist)

    register_payload = {
        "agent_id": elevenlabs_agent_id_inbound,
        "from_number": from_number,
        "to_number": to_number,
        "direction": "inbound",
        "conversation_initiation_client_data": {
            "scenario_context": {
                "autonomy_index": 1,
                "caller_number": from_number,
                "business_id": str(business.get("id")) if business and business.get("id") is not None else None,
                "business_name": business.get("name") if business else None,
                "receptionist_id": str(receptionist.get("id")) if receptionist and receptionist.get("id") is not None else None,
                "receptionist_name": get_receptionist_display_name(receptionist),
                "elevenlabs_voice_id": receptionist.get("elevenlabs_voice_id") if receptionist else None,
                "twilio_to_number": to_number,
                "twilio_call_sid": first_present(payload, "CallSid"),
                "required_opening_disclosure": required_opening,
                "recording_enabled": True,
            }
        },
    }
    add_people_intake_dynamic_variables(
        register_payload["conversation_initiation_client_data"]["scenario_context"],
        business,
    )
    matched_person = lookup_person_record(
        phone_number=from_number,
        business_id=str(business.get("id")) if business and business.get("id") is not None else None,
        user_id=context.get("user_id") or (business or {}).get("user_id"),
    )
    if matched_person:
        scenario_context = register_payload["conversation_initiation_client_data"]["scenario_context"]
        scenario_context["person_id"] = str(matched_person.get("id")) if matched_person.get("id") is not None else None
        scenario_context["customer_name"] = format_person_display_name(matched_person)
        add_person_custom_dynamic_variables(
            scenario_context,
            matched_person,
            str(business.get("id")) if business and business.get("id") is not None else None,
        )
    register_payload["conversation_initiation_client_data"]["scenario_context"] = {
        key: value
        for key, value in register_payload["conversation_initiation_client_data"]["scenario_context"].items()
        if value is not None
    }
    register_payload["conversation_initiation_client_data"]["dynamic_variables"] = {
        key: value
        for key, value in register_payload["conversation_initiation_client_data"]["scenario_context"].items()
        if value is not None
    }
    register_payload["conversation_initiation_client_data"]["conversation_config_override"] = {
        "agent": {"first_message": required_opening},
    }
    register_payload["conversation_initiation_client_data"]["dynamic_variables"]["secret__nodemere_context"] = issue_internal_context(internal_tool_secret, business)
    if receptionist and receptionist.get("elevenlabs_voice_id"):
        register_payload["conversation_initiation_client_data"]["conversation_config_override"]["tts"] = {
            "voice_id": receptionist.get("elevenlabs_voice_id"),
        }

    logging.info('main.twilio_inbound_webhook.event_7139')

    response = requests.post(
        "https://api.elevenlabs.io/v1/convai/twilio/register-call",
        headers={
            "xi-api-key": elevenlabs_api_key,
            "Content-Type": "application/json",
        },
        json=register_payload,
        timeout=30,
    )
    if not response.ok:
        logging.error('main.twilio_inbound_webhook.event_7065')
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail='The request could not be completed',
        )

    return Response(content=response.text, media_type="application/xml")

@app.post("/api/call/route", tags=["Server Tools"])
async def route_call_compat(request: Request, _internal: None = Depends(require_internal_tool_authorization)):
    payload = await parse_request_payload(request)
    call_payload = build_call_route_payload(payload, request)
    context = resolve_business_context(call_payload)
    business = context.get("business")
    resolved_user_id = context.get("user_id") or (business or {}).get("user_id")
    inbound_open, inbound_reason = is_business_call_window_open(business, layer="inbound")
    if not inbound_open:
        return {
            "ok": False,
            "skipped": True,
            "reason": inbound_reason or "Inbound receptionist is unavailable",
        }
    enforce_call_minutes(str(resolved_user_id or ""), business, direction="inbound")
    receptionist = (
        (context.get("receptionist") if receptionist_direction_allows("inbound", (context.get("receptionist") or {}).get("direction")) else None)
        or find_inbound_receptionist_for_business(
            (business or {}).get("id"),
            context.get("user_id") or (business or {}).get("user_id"),
        )
    )
    maybe_auto_verify_business_forwarding(
        business,
        called_number=call_payload.get("to_number"),
    )

    event_payload = {
        **call_payload,
        "user_id": context.get("user_id"),
        "business_id": business.get("id") if business else None,
        "business_name": business.get("name") if business else None,
        "receptionist_id": receptionist.get("id") if receptionist else None,
        "receptionist_name": get_receptionist_display_name(receptionist),
        "forwarding_target_number": get_business_forwarding_target_number(business),
    }

    upsert_active_call_log(
        call_payload,
        user_id=context.get("user_id") or (business or {}).get("user_id"),
        business_id=business.get("id") if business else None,
        receptionist=receptionist,
    )

    event = emit_scenario_trigger(call_payload["trigger_key"], event_payload)
    push_live_event(
        f"Call route trigger received ({call_payload['trigger_key']}).",
        actor="system",
        severity="info",
        event_type="call_route",
        payload=event_payload,
    )

    dynamic_variables = {
        "autonomy_index": 1,
        "authenticate_caller": caller_authentication_allowed(
            user_id=context.get("user_id") or (business or {}).get("user_id"),
            business_id=str(business.get("id")) if business and business.get("id") is not None else None,
        ),
        "caller_number": call_payload.get("from_number"),
        "business_id": str(business.get("id")) if business and business.get("id") is not None else None,
        "business_name": business.get("name") if business else None,
        "receptionist_id": str(receptionist.get("id")) if receptionist and receptionist.get("id") is not None else None,
        "receptionist_name": get_receptionist_display_name(receptionist),
        "elevenlabs_voice_id": receptionist.get("elevenlabs_voice_id") if receptionist else None,
        "twilio_to_number": call_payload.get("to_number"),
        "twilio_call_sid": call_payload.get("call_id"),
    }
    add_people_intake_dynamic_variables(dynamic_variables, business)
    matched_person = lookup_person_record(
        phone_number=call_payload.get("from_number"),
        business_id=str(business.get("id")) if business and business.get("id") is not None else None,
        user_id=context.get("user_id") or (business or {}).get("user_id"),
    )
    if matched_person:
        dynamic_variables["person_id"] = str(matched_person.get("id")) if matched_person.get("id") is not None else None
        dynamic_variables["customer_name"] = format_person_display_name(matched_person)
        add_person_custom_dynamic_variables(
            dynamic_variables,
            matched_person,
            str(business.get("id")) if business and business.get("id") is not None else None,
        )
    dynamic_variables = {key: value for key, value in dynamic_variables.items() if value is not None}
    logging.info('main.route_call_compat.event_7245')

    response_payload = {
        "ok": True,
        "message": "FastAPI call route compatibility endpoint handled the request.",
        "route": event_payload,
        "event": event.get("event"),
        "type": "conversation_initiation_client_data",
        "dynamic_variables": dynamic_variables,
    }
    if receptionist and receptionist.get("elevenlabs_voice_id"):
        response_payload["conversation_config_override"] = {
            "tts": {
                "voice_id": receptionist.get("elevenlabs_voice_id"),
            },
        }
    return response_payload

@app.post("/api/tools/report-intent-checkpoint", tags=["Server Tools"])
async def report_intent_checkpoint(request: IntentCheckpointRequest, _internal: None = Depends(require_internal_tool_authorization)):
    return emit_intent_checkpoint(request)


@app.post("/api/tools/set-agent-data", tags=["Server Tools"])
async def set_agent_data(request: Request, _internal: None = Depends(require_internal_tool_authorization)):
    payload = await parse_request_payload(request)
    updates_payload = extract_agent_data_updates(payload)
    flow_execution_id = first_present(
        updates_payload,
        "flow_execution_id",
        "metadata.flow_execution_id",
        "dynamic_variables.flow_execution_id",
        "conversation_initiation_client_data.dynamic_variables.flow_execution_id",
    )
    update_key = first_present(updates_payload, "key", "name", "variable", "field")
    update_value = deep_get(updates_payload, "value")

    if flow_execution_id and update_key is not None:
        agent_updates = build_agent_update_map(update_key, update_value)
        logging.info('main.set_agent_data.event_7195')
        execution_rows = (
            supabase.table("flow_executions")
            .select("id,status,flow_context")
            .eq("id", str(flow_execution_id))
            .limit(1)
            .execute()
            .data
            or []
        )
        if not execution_rows:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail='The request could not be completed',
            )

        execution = execution_rows[0]
        flow_context = execution.get("flow_context")
        if isinstance(flow_context, str):
            try:
                flow_context = json.loads(flow_context)
            except Exception:
                flow_context = {}
        flow_context = flow_context if isinstance(flow_context, dict) else {}
        merged_agent = deep_merge_dicts(flow_context.get("agent"), agent_updates)
        flow_context["agent"] = merged_agent

        supabase.table("flow_executions").update({
            "flow_context": flow_context,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", str(flow_execution_id)).execute()

        return {
            "ok": True,
            "mode": "execution_context_update",
            "flow_execution_id": str(flow_execution_id),
            "key": str(update_key),
            "value": update_value,
        }

    conversation_id = first_present(
        updates_payload,
        "conversation_id",
        "system__conversation_id",
        "system_conversation_id",
    )
    if not conversation_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either conversation_id or flow_execution_id with key and value is required",
        )

    receptionist_id = first_present(
        updates_payload,
        "hired_receptionist_id",
        "receptionist_id",
        "agent_id",
    )
    receptionist = load_receptionist_by_id(receptionist_id) if receptionist_id else None
    if not receptionist:
        receptionist = lookup_hired_receptionist(
            hired_receptionist_id=first_present(updates_payload, "hired_receptionist_id", "receptionist_id"),
            elevenlabs_agent_id=first_present(updates_payload, "elevenlabs_agent_id", "agent_id"),
        )
    user_id = first_present(updates_payload, "user_id") or (receptionist or {}).get("user_id")
    business_id = first_present(updates_payload, "business_id") or (receptionist or {}).get("business_id")
    receptionist_name = first_present(
        updates_payload,
        "receptionist_name",
        "agent_name",
        "receptionist",
    ) or (receptionist or {}).get("full_name")
    person_id = first_present(updates_payload, "person_id", "record_id", "customer_id")

    update_fields = {
        "conversation_id": str(conversation_id),
        "hired_receptionist_id": int_or_none((receptionist or {}).get("id") or receptionist_id),
        "receptionist_name": str(receptionist_name) if receptionist_name else None,
        "user_id": str(user_id) if user_id else None,
        "business_id": int_or_none(business_id),
        "person_id": int_or_none(person_id),
        "raw_payload": event_metadata(payload),
    }
    update_fields = {key: value for key, value in update_fields.items() if value is not None}

    existing = (
        supabase.table("call_logs")
        .select("id,raw_payload")
        .eq("conversation_id", str(conversation_id))
        .limit(1)
        .execute()
        .data
        or []
    )

    if existing:
        merged_payload = existing[0].get("raw_payload") if isinstance(existing[0].get("raw_payload"), dict) else {}
        merged_payload = {**merged_payload, "agent_data": updates_payload}
        update_fields["raw_payload"] = event_metadata(merged_payload)
        response = supabase.table("call_logs").update(update_fields).eq("id", existing[0]["id"]).execute()
        saved = response.data[0] if getattr(response, "data", None) else update_fields
    else:
        response = supabase.table("call_logs").insert(update_fields).execute()
        saved = response.data[0] if getattr(response, "data", None) else update_fields

    claim_call_milestones(supabase, saved)
    return {"ok": True, "call_log": saved}

@app.api_route("/api/tools/{tool_name}", methods=["GET", "POST"], tags=["Server Tools"])
async def legacy_server_tool(
    tool_name: str,
    request: Request,
    _internal: None = Depends(require_internal_tool_authorization),
):
    payload = await parse_request_payload(request)
    context = resolve_business_context(payload)
    business = context.get("business")
    user_id = context.get("user_id")
    receptionist = context.get("receptionist")

    normalized_tool = (tool_name or "").strip().lower().replace("_", "-")
    if not business or business.get("id") is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Business context is required for internal tools.")

    if normalized_tool in {"check-verification-status", "check-authentication", "verify-authentication", "auth-verify"}:
        context = build_verification_request_context({**payload, "business": business, "user_id": user_id})
        token = first_present(payload, "token", "verification_token")
        session_id = first_present(payload, "session_id", "verification_session_id")
        if not token and not session_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="token or session_id is required")
        return get_verification_status(
            supabase_admin,
            token=token,
            session_id=session_id,
            business_id=context.get("business_id"),
        )

    if normalized_tool in {"request-docs", "document-request", "document-upload-request"}:
        context_payload = {**payload, "business": business, "user_id": user_id}
        context = build_verification_request_context(context_payload)
        request_result = create_document_request(supabase_admin, base_url=verification_base_url, **context)
        return deliver_existing_secure_link_by_email(
            request_result=request_result,
            context=context,
            payload=context_payload,
            kind="document_upload",
        )

    if normalized_tool in {"get-docs", "document-verify", "document-upload-verify"}:
        context = build_verification_request_context({**payload, "business": business, "user_id": user_id})
        token = first_present(payload, "token", "document_token", "request_token")
        request_id = first_present(payload, "request_id", "document_request_id", "session_id")
        if not token and not request_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="token or request_id is required")
        return get_document_request_status(
            supabase_admin,
            token=token,
            request_id=request_id,
            business_id=context.get("business_id"),
        )

    if normalized_tool in {"identify-caller", "lookup-customer"}:
        search_phone = normalize_phone_number(first_present(
            payload,
            "phone",
            "caller_number",
            "from_number",
            "caller_phone",
            "system__caller_id",
            "system_caller_id",
            "From",
        ))
        search_email = first_present(payload, "email", "caller_email")
        search_name = str(first_present(payload, "name", "full_name", "customer_name") or "").strip().lower()

        if not search_phone and not search_email and not search_name:
            return {
                "ok": True,
                "found": False,
                "customer": None,
                "person": None,
                "matches": [],
                "count": 0,
            }

        query = supabase.table("people").select("*")
        if business and business.get("id"):
            query = query.eq("business_id", business["id"])
        elif user_id:
            query = query.eq("user_id", user_id)
        rows = query.limit(200).execute().data or []

        filtered = rows
        if search_phone:
            phone_values = set(build_phone_match_values(search_phone))
            filtered = [
                row for row in filtered
                if set(build_phone_match_values(row.get("phone"))) & phone_values
            ]
        if search_email:
            filtered = [row for row in filtered if (row.get("email") or "").strip().lower() == str(search_email).strip().lower()]
        if search_name:
            filtered = [
                row for row in filtered
                if search_name in " ".join(filter(None, [row.get("first_name"), row.get("last_name")])).strip().lower()
            ]

        matches = filtered[:10]
        return {
            "ok": True,
            "found": bool(matches),
            "customer": matches[0] if matches else None,
            "person": matches[0] if matches else None,
            "matches": matches,
            "count": len(matches),
        }

    if normalized_tool == "get-services":
        query = supabase.table("services").select("*")
        if business and business.get("id"):
            try:
                query = query.eq("business_id", business["id"])
            except Exception:
                pass
        data = query.order("category").order("sort_order").execute().data or []
        return {"ok": True, "services": data, "count": len(data)}

    if normalized_tool == "get-staff":
        query = supabase.table("staff").select(','.join(TOOL_STAFF_FIELDS))
        if business and business.get("id"):
            try:
                query = query.eq("business_id", business["id"])
            except Exception:
                pass
        is_active_value = first_present(payload, "is_active", "active_only")
        if is_active_value is None:
            query = query.eq("is_active", True)
        elif str(is_active_value).strip().lower() in {"true", "1", "yes"}:
            query = query.eq("is_active", True)
        role_value = str(first_present(payload, "role") or "").strip()
        if role_value:
            query = query.ilike("role", f"%{role_value}%")
        raw_rows = query.order("full_name").limit(200).execute().data or []

        search_terms = tokenize_search_terms(
            first_present(payload, "query", "search", "specialty", "service", "service_name"),
            role_value,
        )
        matched_rows = []
        for row in raw_rows:
            score = score_staff_match(row, search_terms)
            if search_terms and score <= 0:
                continue
            matched_rows.append({**row, "_match_score": score})

        matched_rows.sort(key=lambda row: (-int(row.get("_match_score") or 0), str(row.get("full_name") or "")))

        appointment_date = first_present(payload, "date", "appointment_date")
        appointment_time = first_present(payload, "time", "appointment_time")
        appointment_duration = normalize_appointment_duration(first_present(payload, "duration", "appointment_duration"))
        include_availability = bool(appointment_date and appointment_time)

        staff_results = []
        for row in matched_rows:
            next_row = staff_tool_view(row)
            if include_availability:
                within_hours, availability_reason = is_staff_available_during_hours(
                    row,
                    appointment_date,
                    appointment_time,
                    appointment_duration,
                )
                conflicts = [] if not within_hours else list_staff_conflicts(
                    business_id=business.get("id") if business else None,
                    appointment_date=appointment_date,
                    appointment_time=appointment_time,
                    duration=appointment_duration,
                    staff_id=row.get("id"),
                )
                next_row["available"] = within_hours and len(conflicts) == 0
                next_row["availability_reason"] = availability_reason
                next_row["conflicts"] = conflicts
            staff_results.append(next_row)

        return {
            "ok": True,
            "staff": staff_results,
            "count": len(staff_results),
            "matched": len(staff_results) > 0,
            "query": first_present(payload, "query", "search", "specialty", "service", "service_name") or role_value or None,
        }

    if normalized_tool in {"get-business-info", "inbound-get-business-info"}:
        if not business:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business context not found")
        return {
            "ok": True,
            "business": {key: value for key, value in serialize_business_profile_row(business).items()
                         if key in TOOL_BUSINESS_FIELDS},
            "forwarding_target_number": get_business_forwarding_target_number(business),
        }

    if normalized_tool in {"create-person", "create-record"}:
        if not business:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business context not found")

        intake_values = payload.get("intake_values") if isinstance(payload.get("intake_values"), dict) else {}
        intake_values_json = first_present(payload, "intake_values_json")
        if intake_values_json:
            try:
                parsed_intake_values = json.loads(str(intake_values_json))
            except json.JSONDecodeError as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="intake_values_json must be a valid JSON object string",
                ) from exc
            if not isinstance(parsed_intake_values, dict):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="intake_values_json must be a valid JSON object string",
                )
            intake_values = {**intake_values, **parsed_intake_values}
        merged_payload = {**intake_values, **payload}
        merged_payload.pop("intake_values", None)
        merged_payload.pop("intake_values_json", None)
        if first_present(merged_payload, "phone", "customer_phone", "caller_number"):
            merged_payload["phone"] = first_present(merged_payload, "phone", "customer_phone", "caller_number")
        if first_present(merged_payload, "email", "customer_email"):
            merged_payload["email"] = first_present(merged_payload, "email", "customer_email")

        required_intake_fields = [
            field
            for field in build_people_intake_fields(business)
            if field.get("required") is True and field.get("key")
        ]
        missing_intake_fields = [
            {
                "key": field.get("key"),
                "label": field.get("label") or field.get("key"),
                "type": field.get("type"),
                "custom": bool(field.get("custom")),
            }
            for field in required_intake_fields
            if not is_present_intake_value(merged_payload.get(field.get("key")))
        ]
        if missing_intake_fields:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "Missing required intake fields",
                    "missing_intake_fields": missing_intake_fields,
                },
            )

        allowed_standard_fields = {
            "first_name",
            "last_name",
            "phone",
            "email",
            "street_address",
            "city",
            "state",
            "zip_code",
            "preferred_contact_method",
            "preferred_language",
            "best_time_to_contact",
            "consent_sms",
            "consent_call",
            "do_not_call",
            "do_not_text",
            "source",
            "lead_source_detail",
            "special_instructions",
            "notes",
            "status",
            "tags",
        }
        person_payload = {
            key: value
            for key, value in merged_payload.items()
            if key in allowed_standard_fields or str(key).startswith("custom_")
        }
        person_payload["business_id"] = business.get("id")
        person_payload["user_id"] = user_id or business.get("user_id")
        person_payload["phone"] = normalize_phone_number(person_payload.get("phone")) or person_payload.get("phone")

        person_payload = normalize_people_payload_custom_fields(
            person_payload,
            business.get("id"),
        )

        response = supabase.table("people").insert(person_payload).execute()
        created = response.data[0] if response.data else person_payload
        person_name = format_person_display_name(created)
        if person_name:
            created = {**created, "name": person_name}

        schedule_backend_scenario_execution("record_created", {
            "record_id": created.get("id"),
            "person_id": created.get("id"),
            "user_id": created.get("user_id") or user_id or business.get("user_id"),
            "business_id": created.get("business_id") or business.get("id"),
            "person": created,
            "record": created,
        })
        return {
            "ok": True,
            "person": created,
            "record": created,
            "person_id": created.get("id"),
            "record_id": created.get("id"),
        }

    if normalized_tool in {"update-person", "update-record", "update-customer"}:
        if not business:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business context not found")

        person_id = first_present(payload, "people_id", "person_id", "record_id", "customer_id")
        if not person_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="people_id is required")

        allowed_standard_fields = {
            "first_name",
            "last_name",
            "phone",
            "email",
            "street_address",
            "city",
            "state",
            "zip_code",
            "preferred_contact_method",
            "preferred_language",
            "best_time_to_contact",
            "consent_sms",
            "consent_call",
            "do_not_call",
            "do_not_text",
            "source",
            "lead_source_detail",
            "special_instructions",
            "notes",
            "status",
            "tags",
        }
        existing_query = supabase.table("people").select("*").eq("id", str(person_id))
        if business.get("id") is not None:
            existing_query = existing_query.eq("business_id", business["id"])
        elif user_id:
            existing_query = existing_query.eq("user_id", user_id)
        existing_response = existing_query.limit(1).execute()
        if not existing_response.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")

        merged_payload = {**payload}
        custom_fields_json = first_present(payload, "custom_fields_json")
        if custom_fields_json:
            try:
                parsed_custom_fields = json.loads(str(custom_fields_json))
            except json.JSONDecodeError as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="custom_fields_json must be a valid JSON object string",
                ) from exc
            if not isinstance(parsed_custom_fields, dict):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="custom_fields_json must be a valid JSON object string",
                )
            merged_payload.update(parsed_custom_fields)
        merged_payload.pop("custom_fields_json", None)

        updates = {
            key: value
            for key, value in merged_payload.items()
            if key in allowed_standard_fields or str(key).startswith("custom_")
        }
        name = first_present(merged_payload, "name", "full_name", "customer_name")
        if name and not updates.get("first_name") and not updates.get("last_name"):
            parts = str(name).strip().split()
            if parts:
                updates["first_name"] = parts[0]
                if len(parts) > 1:
                    updates["last_name"] = " ".join(parts[1:])
        if first_present(merged_payload, "customer_phone"):
            updates["phone"] = first_present(merged_payload, "customer_phone")
        if first_present(merged_payload, "customer_email"):
            updates["email"] = first_present(merged_payload, "customer_email")
        if updates.get("phone"):
            updates["phone"] = normalize_phone_number(updates.get("phone")) or updates.get("phone")

        if not updates:
            existing = existing_response.data[0]
            return {
                "ok": True,
                "person": existing,
                "record": existing,
                "person_id": existing.get("id"),
                "people_id": existing.get("id"),
                "record_id": existing.get("id"),
                "updated": False,
            }

        updates = normalize_people_payload_custom_fields(
            updates,
            business.get("id"),
            existing_response.data[0].get("custom_fields"),
        )
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        response = supabase.table("people").update(updates).eq("id", str(person_id)).execute()
        updated = (response.data or [{**existing_response.data[0], **updates}])[0]
        schedule_backend_scenario_execution("record_updated", {
            "record_id": updated.get("id") or person_id,
            "person_id": updated.get("id") or person_id,
            "user_id": updated.get("user_id") or user_id or business.get("user_id"),
            "business_id": updated.get("business_id") or business.get("id"),
            "person": updated,
            "record": updated,
        })
        return {
            "ok": True,
            "person": updated,
            "record": updated,
            "person_id": updated.get("id") or person_id,
            "people_id": updated.get("id") or person_id,
            "record_id": updated.get("id") or person_id,
            "updated": True,
        }

    if normalized_tool == "check-availability":
        if not business:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business context not found")

        raw_appointment_date = first_present(payload, "date", "appointment_date")
        if raw_appointment_date is None or not str(raw_appointment_date).strip():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="date is required")
        appointment_date = normalize_appointment_date_value(raw_appointment_date)
        raw_appointment_time = first_present(payload, "time", "appointment_time")
        appointment_time = (
            normalize_appointment_time_value(raw_appointment_time)
            if raw_appointment_time is not None and str(raw_appointment_time).strip()
            else None
        )
        appointment_duration = normalize_appointment_duration(first_present(payload, "duration", "appointment_duration"))
        business_id = business.get("id") if business else None
        within_business_hours, business_reason = is_business_available_during_hours(
            business,
            appointment_date,
            appointment_time,
            appointment_duration,
            layer="business",
        )
        if not within_business_hours:
            return {
                "ok": True,
                "available": False,
                "requested": {"date": appointment_date, "time": appointment_time, "duration": appointment_duration},
                "reason": business_reason,
                "conflicts": [],
                "available_staff": [],
            }
        requested_staff = load_staff_record(
            first_present(payload, "staff_id"),
            business_id=business_id,
            require_active=False,
        )
        if first_present(payload, "staff_id") is not None and not requested_staff:
            return {
                "ok": True,
                "available": False,
                "requested": {"date": appointment_date, "time": appointment_time, "duration": appointment_duration, "staff_id": first_present(payload, "staff_id")},
                "reason": "Staff member not found",
                "conflicts": [],
                "available_staff": [],
            }
        if requested_staff:
            within_hours, reason = is_staff_available_during_hours(
                requested_staff,
                appointment_date,
                appointment_time,
                appointment_duration,
            )
            conflicts = [] if not within_hours else list_staff_conflicts(
                business_id=business_id,
                appointment_date=appointment_date,
                appointment_time=appointment_time,
                duration=appointment_duration,
                staff_id=requested_staff.get("id"),
            )
            availability_reason = reason
            if not availability_reason and conflicts:
                availability_reason = "Requested time conflicts with an existing appointment"
            return {
                "ok": True,
                "available": within_hours and len(conflicts) == 0,
                "requested": {
                    "date": appointment_date,
                    "time": appointment_time,
                    "duration": appointment_duration,
                    "staff_id": requested_staff.get("id"),
                },
                "reason": availability_reason or business_reason,
                "conflicts": conflicts,
                "staff": staff_tool_view(requested_staff),
                "available_staff": [staff_tool_view(requested_staff)] if within_hours and len(conflicts) == 0 else [],
            }

        staff_query = supabase.table("staff").select(','.join(TOOL_STAFF_FIELDS))
        if business_id is not None:
            staff_query = staff_query.eq("business_id", business_id)
        staff_rows = staff_query.eq("is_active", True).limit(200).execute().data or []
        available_staff = []
        aggregated_conflicts = []
        for staff_row in staff_rows:
            within_hours, _reason = is_staff_available_during_hours(
                staff_row,
                appointment_date,
                appointment_time,
                appointment_duration,
            )
            if not within_hours:
                continue
            staff_conflicts = list_staff_conflicts(
                business_id=business_id,
                appointment_date=appointment_date,
                appointment_time=appointment_time,
                duration=appointment_duration,
                staff_id=staff_row.get("id"),
            )
            if staff_conflicts:
                aggregated_conflicts.extend(staff_conflicts)
                continue
            available_staff.append(staff_tool_view(staff_row))
        return {
            "ok": True,
            "available": len(available_staff) > 0,
            "requested": {"date": appointment_date, "time": appointment_time, "duration": appointment_duration},
            "reason": None if available_staff else "No staff members are available for the requested time",
            "conflicts": aggregated_conflicts,
            "available_staff": available_staff,
        }

    if normalized_tool in {"get-appointments", "search-appointments"}:
        if not business:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business context not found")

        business_id = business.get("id")
        person_id = int_or_none(first_present(payload, "person_id", "record_id", "customer_id"))
        search_phone = normalize_phone_number(first_present(payload, "phone", "caller_number", "from_number", "customer_phone"))
        search_email = str(first_present(payload, "email", "customer_email") or "").strip().lower()
        search_name = str(first_present(payload, "name", "full_name", "customer_name") or "").strip().lower()

        matched_people = []
        if not person_id and (search_phone or search_email or search_name):
            people_query = supabase.table("people").select("*").eq("business_id", business_id).limit(500)
            people_rows = people_query.execute().data or []
            filtered_people = people_rows
            if search_phone:
                phone_values = set(build_phone_match_values(search_phone))
                filtered_people = [
                    row for row in filtered_people
                    if set(build_phone_match_values(row.get("phone"))) & phone_values
                ]
            if search_email:
                filtered_people = [
                    row for row in filtered_people
                    if str(row.get("email") or "").strip().lower() == search_email
                ]
            if search_name:
                filtered_people = [
                    row for row in filtered_people
                    if search_name in " ".join(filter(None, [row.get("first_name"), row.get("last_name")])).strip().lower()
                ]
            matched_people = filtered_people[:10]
            if matched_people:
                person_id = int_or_none(matched_people[0].get("id"))

        appointment_id = uuid_or_none(first_present(payload, "appointment_id", "id"))
        status_value = str(first_present(payload, "status", "appointment_status") or "").strip().lower()
        date_value = normalize_appointment_date_value(first_present(payload, "date", "appointment_date"), fallback=None)
        date_from = normalize_appointment_date_value(first_present(payload, "date_from", "start_date"), fallback=None)
        date_to = normalize_appointment_date_value(first_present(payload, "date_to", "end_date"), fallback=None)
        include_cancelled = str(first_present(payload, "include_cancelled") or "").strip().lower() in {"true", "1", "yes"}
        limit_value = int_or_none(first_present(payload, "limit"))
        limit_value = max(1, min(limit_value or 10, 50))

        query = supabase.table("appointments").select("*").eq("business_id", business_id)
        if appointment_id:
            query = query.eq("id", appointment_id)
        if person_id:
            query = query.eq("person_id", person_id)
        if status_value:
            query = query.eq("status", normalize_appointment_status(status_value))
        elif not include_cancelled:
            query = query.neq("status", "cancelled")
        if date_value:
            query = query.eq("date", date_value)
        if date_from:
            query = query.gte("date", date_from)
        if date_to:
            query = query.lte("date", date_to)

        appointments = query.order("date").order("time").limit(limit_value).execute().data or []
        return {
            "ok": True,
            "appointments": appointments,
            "appointment": appointments[0] if appointments else None,
            "found": bool(appointments),
            "count": len(appointments),
            "person": matched_people[0] if matched_people else None,
            "people_matches": matched_people,
        }

    if normalized_tool == "create-appointment":
        if not business:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business context not found")
        intake_values = payload.get("intake_values") if isinstance(payload.get("intake_values"), dict) else {}
        intake_values_json = first_present(payload, "intake_values_json")
        if intake_values_json:
            try:
                parsed_intake_values = json.loads(str(intake_values_json))
            except json.JSONDecodeError as exc:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="intake_values_json must be a valid JSON object string") from exc
            if not isinstance(parsed_intake_values, dict):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="intake_values_json must be a valid JSON object string")
            intake_values = {**intake_values, **parsed_intake_values}
        merged_payload = {**intake_values, **payload}
        merged_payload.pop("intake_values", None)
        merged_payload.pop("intake_values_json", None)
        appointment_date = normalize_appointment_date_value(first_present(merged_payload, "date", "appointment_date"))
        appointment_time = normalize_appointment_time_value(first_present(merged_payload, "time", "appointment_time"))
        appointment_duration = normalize_appointment_duration(first_present(merged_payload, "duration", "appointment_duration"))
        person_id = safe_appointment_person_id(first_present(merged_payload, "person_id"), business_id=(business or {}).get("id"))
        requested_staff_id = first_present(merged_payload, "staff_id")
        staff_id = safe_appointment_staff_id(requested_staff_id, business_id=business.get("id"), require_active=False)
        if requested_staff_id is not None and staff_id is None:
            return {"ok": False, "appointment": None, "reason": "Staff member not found"}
        schedule_valid, schedule_reason, schedule_conflicts = validate_appointment_schedule(
            business,
            appointment_date,
            appointment_time,
            appointment_duration,
            staff_id=staff_id,
        )
        if not schedule_valid:
            return {
                "ok": False,
                "appointment": None,
                "reason": schedule_reason,
                "conflicts": schedule_conflicts,
            }
        appointment_row = {
            "date": appointment_date,
            "time": appointment_time,
            "duration": appointment_duration,
            "status": normalize_appointment_status(first_present(merged_payload, "status")),
            "receptionist_id": int_or_none(first_present(merged_payload, "receptionist_id", "hired_receptionist_id")) or (receptionist or {}).get("id"),
            "notes": first_present(merged_payload, "notes"),
            "person_id": person_id,
            "service_id": safe_appointment_service_id(first_present(merged_payload, "service_id"), business_id=(business or {}).get("id")),
            "staff_id": staff_id,
            "business_id": business.get("id") if business else None,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if first_present(merged_payload, "source") is not None:
            appointment_row["source"] = first_present(merged_payload, "source")
        response = supabase.table("appointments").insert(appointment_row).execute()
        created = response.data[0] if response.data else appointment_row
        created = {"action": "create_appointment", "table": "appointments", **created}
        emit_scenario_trigger(
            "appointment_created",
            {
                "appointment": created,
                "appointment_id": created.get("id"),
                "person_id": created.get("person_id"),
                "service_id": created.get("service_id"),
                "staff_id": created.get("staff_id"),
                "business_id": business.get("id") if business else None,
            },
        )
        emit_appointment_change_triggers(None, created, business_id=business.get("id") if business else None, include_updated=False)
        return {"ok": True, "appointment": created}

    if normalized_tool == "update-appointment":
        appointment_id = uuid_or_none(first_present(payload, "appointment_id", "id"))
        if not appointment_id:
            return {"ok": True, "appointment": {"action": "update_appointment", "skipped": True, "reason": "appointment_id is required"}}
        existing_query = supabase.table("appointments").select("*").eq("id", appointment_id)
        if business and business.get("id") is not None:
            existing_query = existing_query.eq("business_id", business.get("id"))
        existing_response = existing_query.limit(1).execute()
        existing = existing_response.data[0] if existing_response.data else None
        if not existing:
            return {"ok": True, "appointment": {"id": appointment_id, "action": "update_appointment", "skipped": True, "reason": "Appointment not found"}}
        update_payload = {**payload}
        updates = {}
        if first_present(payload, "date", "appointment_date") is not None:
            updates["date"] = normalize_appointment_date_value(first_present(payload, "date", "appointment_date"))
        if first_present(payload, "time", "appointment_time") is not None:
            updates["time"] = normalize_appointment_time_value(first_present(payload, "time", "appointment_time"))
        if first_present(payload, "duration", "appointment_duration") is not None:
            updates["duration"] = normalize_appointment_duration(first_present(payload, "duration", "appointment_duration"))
        if first_present(payload, "status") is not None:
            updates["status"] = normalize_appointment_status(first_present(payload, "status"))
        if first_present(payload, "receptionist_id", "hired_receptionist_id") is not None:
            updates["receptionist_id"] = int_or_none(first_present(payload, "receptionist_id", "hired_receptionist_id"))
        if first_present(payload, "notes") is not None:
            updates["notes"] = first_present(payload, "notes")
        if first_present(payload, "person_id") is not None:
            safe_person_id = safe_appointment_person_id(first_present(payload, "person_id"), business_id=(business or {}).get("id"))
            if safe_person_id is not None:
                updates["person_id"] = safe_person_id
        if first_present(payload, "service_id") is not None:
            safe_service_id = safe_appointment_service_id(first_present(payload, "service_id"), business_id=(business or {}).get("id"))
            if safe_service_id is not None:
                updates["service_id"] = safe_service_id
        if first_present(payload, "staff_id") is not None:
            safe_staff_id = safe_appointment_staff_id(
                first_present(payload, "staff_id"),
                business_id=business.get("id") if business else existing.get("business_id"),
                require_active=False,
            )
            if safe_staff_id is not None:
                updates["staff_id"] = safe_staff_id
        schedule_fields_changed = any(field in updates for field in ("date", "time", "duration", "staff_id"))
        candidate_status = updates.get("status", existing.get("status"))
        if schedule_fields_changed and str(candidate_status or "").strip().lower() not in {"cancelled", "completed", "missed"}:
            appointment_business = business or load_business_by_id(existing.get("business_id"))
            schedule_valid, schedule_reason, schedule_conflicts = validate_appointment_schedule(
                appointment_business,
                updates.get("date", existing.get("date")),
                updates.get("time", existing.get("time")),
                updates.get("duration", existing.get("duration")),
                staff_id=updates.get("staff_id", existing.get("staff_id")),
                exclude_appointment_id=appointment_id,
            )
            if not schedule_valid:
                return {
                    "ok": False,
                    "appointment": None,
                    "reason": schedule_reason,
                    "conflicts": schedule_conflicts,
                }
        if not updates:
            return {"ok": True, "appointment": {"id": appointment_id, "action": "update_appointment", "skipped": True, "reason": "No valid appointment fields to update"}}
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        response = supabase.table("appointments").update(updates).eq("id", appointment_id).execute()
        updated = response.data[0] if response.data else {**existing, **updates}
        updated = {"action": "update_appointment", "table": "appointments", **updated}
        emit_appointment_change_triggers(existing, updated, business_id=business.get("id") if business else None)
        return {"ok": True, "appointment": updated}

    if normalized_tool == "cancel-appointment":
        appointment_id = uuid_or_none(first_present(payload, "appointment_id", "id"))
        if not appointment_id:
            return {"ok": True, "appointment": {"action": "cancel_appointment", "skipped": True, "reason": "appointment_id is required"}}
        existing_query = supabase.table("appointments").select("*").eq("id", appointment_id)
        if business and business.get("id") is not None:
            existing_query = existing_query.eq("business_id", business.get("id"))
        existing_response = existing_query.limit(1).execute()
        existing = existing_response.data[0] if existing_response.data else None
        if not existing:
            return {"ok": True, "appointment": {"id": appointment_id, "action": "cancel_appointment", "skipped": True, "reason": "Appointment not found"}}
        response = supabase.table("appointments").update({
            "status": "cancelled",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", appointment_id).execute()
        cancelled = response.data[0] if response.data else {**existing, "status": "cancelled", "updated_at": datetime.now(timezone.utc).isoformat()}
        cancelled = {"action": "cancel_appointment", "table": "appointments", **cancelled}
        emit_appointment_change_triggers(existing, cancelled, business_id=business.get("id") if business else None)
        return {"ok": True, "appointment": cancelled}

    if normalized_tool == "log-call-outcome":
        duration_seconds = first_present(payload, "duration_seconds", "duration")
        call_log = {
            "source": "server_tool",
            "provider_call_sid": first_present(payload, "call_id", "CallSid", "callSid"),
            "conversation_id": first_present(payload, "conversation_id"),
            "elevenlabs_agent_id": first_present(payload, "agent_id", "elevenlabs_agent_id"),
            "hired_receptionist_id": (receptionist or {}).get("id") or first_present(payload, "hired_receptionist_id", "receptionist_id"),
            "user_id": user_id,
            "business_id": (business or {}).get("id") or first_present(payload, "business_id"),
            "receptionist_name": (receptionist or {}).get("full_name") or first_present(payload, "receptionist_name"),
            "scenario_id": first_present(payload, "scenario_id"),
            "from_number": normalize_phone_number(first_present(payload, "from_number", "From", "caller_phone")),
            "to_number": normalize_phone_number(first_present(payload, "to_number", "To", "phone_number")) or get_business_forwarding_target_number(business),
            "started_at": first_present(payload, "started_at"),
            "ended_at": first_present(payload, "ended_at"),
            "duration_seconds": duration_seconds,
            "status": first_present(payload, "status", "call_status"),
            "outcome": first_present(payload, "outcome"),
            "summary": first_present(payload, "summary"),
            "transcript_text": first_present(payload, "transcript", "transcript_text"),
            "raw_payload": event_metadata(payload),
        }
        response = supabase.table("call_logs").insert(call_log).execute()
        saved = response.data[0] if response.data else call_log
        claim_call_milestones(supabase, saved)
        record_call_nest_event(supabase, saved)
        increment_business_usage_summary(call_log.get("business_id"), duration_seconds)
        return {"ok": True, "call_log": saved}

    if normalized_tool == "transfer-call":
        transfer_payload = {
            "business_id": business.get("id") if business else None,
            "user_id": user_id,
            "receptionist_id": (receptionist or {}).get("id"),
            "target_number": first_present(payload, "target_number", "phone_number", "transfer_to"),
            "reason": first_present(payload, "reason"),
            "requested_at": datetime.now(timezone.utc).isoformat(),
        }
        push_live_event(
            "Transfer call requested.",
            actor="system",
            severity="info",
            event_type="transfer_call",
            payload=transfer_payload,
        )
        record_nest_event(
            supabase,
            business_id=transfer_payload.get("business_id"),
            user_id=transfer_payload.get("user_id"),
            category="calls",
            event_type="call_transferred",
            title="Call transferred",
            message=str(transfer_payload.get("target_number") or ""),
            priority="major",
            payload=transfer_payload,
            source_id=transfer_payload.get("requested_at"),
            idempotency_key=f"call-transfer:{transfer_payload.get('requested_at')}",
        )
        return {"ok": True, "status": "queued", "transfer": transfer_payload}

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='The request could not be completed')

@app.post("/api/webhooks/elevenlabs/post-call", tags=["Server Tools"])
async def elevenlabs_post_call_webhook(
    request: Request,
    x_webhook_secret: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    raw_body = await request.body()
    if not elevenlabs_webhook_secret:
        logging.error('main.elevenlabs_post_call_webhook.event_8142')
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ElevenLabs webhook verification is not configured.",
        )

    hmac_signature = request.headers.get("elevenlabs-signature")
    if hmac_signature:
            if ElevenLabs is None:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="ElevenLabs SDK is required for HMAC webhook verification.",
                )
            try:
                elevenlabs_client = ElevenLabs(api_key=elevenlabs_api_key or "")
                payload = elevenlabs_client.webhooks.construct_event(
                    rawBody=raw_body.decode("utf-8"),
                    sig_header=hmac_signature,
                    secret=elevenlabs_webhook_secret,
                )
            except Exception as exc:
                logging.warning('main.elevenlabs_post_call_webhook.event_8101')
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook signature") from exc
    else:
        bearer_secret = None
        if authorization and authorization.lower().startswith("bearer "):
            bearer_secret = authorization.split(" ", 1)[1].strip()
        presented_secret = x_webhook_secret or bearer_secret
        if not hmac.compare_digest(presented_secret or "", elevenlabs_webhook_secret):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook secret")
        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON payload") from exc

    if not isinstance(payload, dict):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Webhook payload must be a JSON object")

    webhook_type, event_timestamp, event_data = get_elevenlabs_event_data(payload)
    conversation_id = first_present(
        event_data,
        "conversation_id",
        "conversation_initiation_client_data.dynamic_variables.system__conversation_id",
    )

    from .authorization import trusted_call_tenant, tenant_scope
    dynamic=extract_dynamic_variables(event_data)
    capability=dynamic.get("secret__nodemere_context")
    provider_sid=first_present(event_data,"metadata.phone_call.call_sid","metadata.call_sid","provider_call_sid")
    claims=verify_internal_context(internal_tool_secret,capability,allow_expired=True) if capability else None
    if claims and int(claims['exp']) <= int(time.time()):
        # A verified provider can deliver a late event for an already-bound
        # call. Expired capabilities must never establish a new call binding.
        trusted_call_tenant(getattr(supabase_admin,"raw",supabase_admin),
            conversation_id=conversation_id,provider_call_sid=provider_sid)
    tenant=trusted_call_tenant(getattr(supabase_admin,"raw",supabase_admin),claims=claims,
        conversation_id=conversation_id,provider_call_sid=provider_sid)
    validate_references(getattr(supabase_admin,"raw",supabase_admin),tenant,dynamic)
    with tenant_scope(tenant):
        return await persist_elevenlabs_event(payload)


async def persist_elevenlabs_event(payload):
    webhook_type,event_timestamp,event_data=get_elevenlabs_event_data(payload)
    conversation_id=first_present(event_data,"conversation_id","conversation_initiation_client_data.dynamic_variables.system__conversation_id")
    if webhook_type == "post_call_audio":
        audio_storage_path = upload_call_recording(
            str(conversation_id) if conversation_id else "",
            str(event_data.get("full_audio") or ""),
            agent_id=event_data.get("agent_id"),
        )
        updates = {
            "webhook_type": webhook_type,
            "event_timestamp": event_timestamp,
            "elevenlabs_agent_id": str(event_data.get("agent_id")) if event_data.get("agent_id") else None,
            "conversation_id": str(conversation_id) if conversation_id else None,
            "has_audio": True if audio_storage_path else None,
            "audio_storage_path": audio_storage_path,
            "raw_payload": event_metadata(payload),
            "business_id": current_tenant.get().business_id,
            "user_id": current_tenant.get().owner_id,
        }
        updates = {key: value for key, value in updates.items() if value is not None}
        try:
            existing = []
            if conversation_id:
                existing = (
                    supabase.table("call_logs")
                    .select("id")
                    .eq("conversation_id", str(conversation_id))
                    .limit(1)
                    .execute()
                    .data
                    or []
                )
            if existing:
                response = supabase.table("call_logs").update(updates).eq("id", existing[0]["id"]).execute()
                saved = response.data[0] if getattr(response, "data", None) else updates
            else:
                response = supabase.table("call_logs").insert(updates).execute()
                saved = response.data[0] if getattr(response, "data", None) else updates
        except Exception as exc:
            logging.error('main.elevenlabs_post_call_webhook.event_8160')
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to persist call audio",
            ) from exc
        return {"ok": True, "type": webhook_type, "call_log_id": saved.get("id")}

    call_log = extract_call_log_from_elevenlabs_payload(payload)
    logging.info('main.elevenlabs_post_call_webhook.event_8322')
    tenant=current_tenant.get()
    business_context={"business":load_business_by_id(tenant.business_id),"user_id":tenant.owner_id}
    call_log["business_id"]=tenant.business_id
    call_log["user_id"]=tenant.owner_id
    validate_references(getattr(supabase_admin,"raw",supabase_admin),tenant,{k:v for k,v in call_log.items() if k in {"hired_receptionist_id","scenario_id"}})
    enrich_call_log_with_person(
        call_log,
        payload_data=event_data,
        business_id=(business_context.get("business") or {}).get("id"),
        user_id=business_context.get("user_id"),
    )
    verification_called_number = call_log.get("to_number")
    if not verification_called_number and str(call_log.get("direction") or "").lower() == "inbound":
        verification_called_number = ((business_context.get("business") or {}).get("twilio_number"))
        if verification_called_number:
            logging.info('main.elevenlabs_post_call_webhook.event_8203')
    maybe_auto_verify_business_forwarding(
        business_context.get("business"),
        called_number=verification_called_number,
    )

    try:
        existing = []
        if call_log.get("conversation_id"):
            existing = (
                supabase.table("call_logs")
                .select("id,audio_storage_path,duration_seconds,business_id")
                .eq("conversation_id", call_log["conversation_id"])
                .limit(1)
                .execute()
                .data
                or []
            )
        if not existing and call_log.get("provider_call_sid"):
            existing = (
                supabase.table("call_logs")
                .select("id,audio_storage_path,duration_seconds,business_id")
                .eq("provider_call_sid", str(call_log["provider_call_sid"]))
                .limit(1)
                .execute()
                .data
                or []
            )
        if not existing and call_log.get("business_id") and call_log.get("from_number"):
            existing = (
                supabase.table("call_logs")
                .select("id,audio_storage_path,duration_seconds,business_id")
                .eq("business_id", str(call_log["business_id"]))
                .eq("from_number", call_log["from_number"])
                .eq("status", "in-progress")
                .order("started_at", desc=True)
                .limit(1)
                .execute()
                .data
                or []
            )
        if existing:
            if existing[0].get("audio_storage_path") and not call_log.get("audio_storage_path"):
                call_log["audio_storage_path"] = existing[0]["audio_storage_path"]
            response = supabase.table("call_logs").update(call_log).eq("id", existing[0]["id"]).execute()
        else:
            response = supabase.table("call_logs").insert(call_log).execute()
    except Exception as exc:
        logging.error('main.elevenlabs_post_call_webhook.event_8254')
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to persist call log",
        ) from exc

    saved = response.data[0] if getattr(response, "data", None) else {**(existing[0] if existing else {}), **call_log}
    claim_call_milestones(supabase, saved)
    record_call_nest_event(supabase, saved)
    previous_duration_seconds = parse_usage_seconds(existing[0].get("duration_seconds")) if existing else 0
    saved_duration_seconds = parse_usage_seconds(saved.get("duration_seconds") or call_log.get("duration_seconds"))
    usage_business_id = saved.get("business_id") or call_log.get("business_id") or (existing[0].get("business_id") if existing else None)
    increment_business_usage_summary(usage_business_id, max(0, saved_duration_seconds - (previous_duration_seconds or 0)))
    if call_log.get("hired_receptionist_id"):
        refresh_receptionist_call_metrics(call_log.get("hired_receptionist_id"))

    flow_execution_id = first_present(
        event_data,
        "flow_execution_id",
        "metadata.flow_execution_id",
        "dynamic_variables.flow_execution_id",
        "conversation_initiation_client_data.scenario_context.flow_execution_id",
        "conversation_initiation_client_data.scenario_context.execution_id",
        "conversation_initiation_client_data.dynamic_variables.flow_execution_id",
        "conversation_initiation_client_data.dynamic_variables.execution_id",
        "raw_payload.conversation_initiation_client_data.scenario_context.flow_execution_id",
        "raw_payload.conversation_initiation_client_data.dynamic_variables.flow_execution_id",
    )
    agent_data = (
        deep_get(event_data, "agent_data")
        or deep_get(event_data, "analysis.data_collection_results")
        or deep_get(event_data, "analysis.extracted_variables")
        or {}
    )
    if flow_execution_id and scenario_engine:
        from .authorization import require_record
        require_record(getattr(supabase_admin,"raw",supabase_admin),tenant,"flow_executions",flow_execution_id)
        try:
            resume_result = await scenario_engine.resume_execution(
                str(flow_execution_id),
                {
                    "agent": agent_data if isinstance(agent_data, dict) else {},
                    "call": {
                        "call_sid": call_log.get("external_call_id"),
                        "call_outcome": call_log.get("outcome"),
                    },
                },
            )
            call_report = build_call_report(resume_result.get("context"))
            if call_report and saved.get("id"):
                try:
                    update_response = (
                        supabase.table("call_logs")
                        .update({
                            "call_report": call_report,
                        })
                        .eq("id", saved["id"])
                        .execute()
                    )
                    if getattr(update_response, "data", None):
                        saved = update_response.data[0]
                    else:
                        saved["call_report"] = call_report
                except Exception as exc:
                    logging.error('main.elevenlabs_post_call_webhook.event_8292')
        except Exception as exc:
            logging.error('main.elevenlabs_post_call_webhook.event_8300')

    return {"ok": True, "call_log_id": saved.get("id")}

@app.get("/api/agents", tags=["Sonar Controller Compat"])
async def get_sonar_agents(include_archived: bool = False, current_user: dict = Depends(get_current_user)):
    try:
        current_user_id = business_owner_id(current_user)
        response = (
            supabase
            .table('hired_receptionists')
            .select('*')
            .eq('user_id', current_user_id)
            .order('hired_at', desc=True)
            .execute()
        )
        agents = []
        for row in response.data or []:
            is_archived = row.get("is_active") is False or str(row.get("status") or "").strip().lower() == "archived"
            if not include_archived and is_archived:
                continue
            row_direction = normalize_receptionist_direction(row.get("direction"))
            agents.append({
                **row,
                "is_archived": is_archived,
                "raw_status": row.get("status"),
                "direction": row_direction,
                "name": row.get("full_name") or row.get("first_name") or "Receptionist",
                "role": row.get("stereotype") or "Receptionist",
                "status": derive_receptionist_status(
                    row.get("status"),
                    preserve_offline=False,
                    direction=row_direction,
                ),
                "current_activity": row.get("current_activity") or "Idle",
                "model": row.get("model"),
            })
        return agents
    except Exception as exc:
        logging.error('main.get_sonar_agents.event_8357')
        return []

@app.post("/api/agents/{agent_id}/restore", tags=["Sonar Controller Compat"])
async def restore_agent(agent_id: str, current_user: dict = Depends(get_current_user)):
    current_user_id = business_owner_id(current_user)
    existing_response = (
        supabase
        .table('hired_receptionists')
        .select('id,user_id,full_name,first_name')
        .eq('id', agent_id)
        .eq('user_id', current_user_id)
        .limit(1)
        .execute()
    )
    existing_agent = (existing_response.data or [None])[0]
    if not existing_agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    restore_payload = {
        "is_active": True,
        "status": "active",
        "direction": "all",
    }
    response = (
        supabase
        .table('hired_receptionists')
        .update(restore_payload)
        .eq('id', agent_id)
        .eq('user_id', current_user_id)
        .execute()
    )
    restored_agent = (response.data or [None])[0] or {"id": agent_id, **restore_payload}
    push_live_event(
        "Agent restored.",
        actor="system",
        severity="info",
        event_type="agent_restored",
        payload={
            "agent_id": agent_id,
            "user_id": current_user_id,
            "name": existing_agent.get('full_name') or existing_agent.get('first_name') or "Receptionist",
        },
    )
    return {"ok": True, "agent": restored_agent}

@app.get("/api/system/summary", tags=["Sonar Controller Compat"])
async def get_sonar_system_summary(current_user: dict = Depends(get_current_user)):
    try:
        agents = (
            supabase
            .table('hired_receptionists')
            .select('id,direction')
            .eq('user_id', business_owner_id(current_user))
            .execute()
            .data
            or []
        )
        active_agents = len([
            agent
            for agent in agents
            if receptionist_direction_allows("inbound", agent.get("direction"))
            or receptionist_direction_allows("outbound", agent.get("direction"))
        ])
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


@app.get("/api/sonar/project-intelligence", tags=["Sonar Project Intelligence"])
async def get_sonar_project_intelligence(current_user: dict = Depends(get_current_user)):
    """Return the cached source analysis and cached market working set."""
    return await asyncio.to_thread(get_project_intelligence)


@app.get("/api/sonar/business-intelligence", tags=["Sonar Business Intelligence"])
async def get_sonar_business_intelligence(current_user: dict = Depends(get_current_user)):
    """Return a tenant-scoped, evidence-backed operating report."""
    try:
        return await asyncio.to_thread(get_business_intelligence, supabase, user_id=business_owner_id(current_user))
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='The request could not be completed') from exc


@app.get("/api/sonar/nest/history", tags=["Sonar Nest"])
async def get_sonar_nest_history(limit: int = 40, current_user: dict = Depends(get_current_user)):
    """Return a small tenant-scoped history normalized from existing business activity."""
    business = load_business_by_user_id(business_owner_id(current_user))
    if not business:
        return {"events": []}
    events = await asyncio.to_thread(
        get_nest_history,
        supabase,
        business_id=business.get("id"),
        user_id=business_owner_id(current_user),
        limit=max(1, min(limit, 100)),
    )
    return {"events": events}


@app.post("/api/sonar/nest/claim", tags=["Sonar Nest"])
async def claim_sonar_nest_milestone(payload: dict, current_user: dict = Depends(get_current_user)):
    """Claim a verified business milestone for cross-device Nest delivery."""

    milestone_key = str((payload or {}).get("milestone_key") or "").strip()
    if milestone_key not in MILESTONE_KEYS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported Nest milestone")

    business = load_business_by_user_id(business_owner_id(current_user))
    if not business:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")

    # The client may report a source event, but the server verifies that the
    # business data exists before it can create a durable milestone row.
    source_checks = {
        "first_receptionist_hired": ("hired_receptionists", "business_id"),
        "first_staff_member_added": ("staff", "business_id"),
        "first_call_received": ("call_logs", "business_id"),
        "first_successful_call": ("call_logs", "business_id"),
        "first_receptionist_booking": ("appointments", "business_id"),
        "first_person_added": ("people", "business_id"),
        "first_appointment_booked": ("appointments", "business_id"),
        "first_appointment_completed": ("appointments", "business_id"),
        "first_scenario_created": ("scenarios", "business_id"),
        "first_scenario_run": ("flow_executions", "business_id"),
        "first_successful_workflow": ("flow_executions", "business_id"),
        "first_successful_payment": ("payments", "business_id"),
    }
    source = source_checks.get(milestone_key)
    if source:
        source_table, business_field = source
        source_query = supabase_admin.table(source_table).select("id").eq(business_field, business["id"])
        if milestone_key == "first_appointment_completed":
            source_query = source_query.eq("status", "completed")
        elif milestone_key == "first_successful_workflow":
            source_query = source_query.eq("status", "completed")
        elif milestone_key == "first_successful_payment":
            source_query = source_query.in_("status", ["paid", "succeeded", "successful", "complete", "completed"])
        elif milestone_key == "first_call_received":
            source_query = source_query.ilike("direction", "in%")
        if not source_query.limit(1).execute().data:
            return {"claimed": False, "reason": "Milestone source has not been verified"}

    titles = {
        "first_receptionist_hired": "First receptionist hired",
        "first_staff_member_added": "First staff member added",
        "first_call_received": "First call received",
        "first_successful_call": "First successful call",
        "first_receptionist_booking": "First receptionist booking",
        "first_person_added": "First person added",
        "first_appointment_booked": "First appointment booked",
        "first_appointment_completed": "First appointment completed",
        "first_scenario_created": "First scenario created",
        "first_scenario_run": "First scenario run",
        "first_successful_workflow": "First successful workflow",
        "first_successful_payment": "First successful payment",
        "first_invoice_paid": "First invoice paid",
        "first_repeat_customer": "First repeat customer",
        "first_automated_booking": "First automated booking",
        "first_automated_follow_up": "First automated follow-up",
        "business_setup_completed": "Business setup completed",
    }
    claimed = claim_nest_milestone(
        supabase_admin,
        business_id=business["id"],
        user_id=business_owner_id(current_user),
        milestone_key=milestone_key,
        title=titles[milestone_key],
        message=str((payload or {}).get("message") or ""),
        source_id=(payload or {}).get("source_id"),
        payload=(payload or {}).get("payload") if isinstance((payload or {}).get("payload"), dict) else {},
    )
    return {"claimed": claimed}


@app.get("/api/public/project-intelligence", tags=["Public Project Intelligence"])
async def get_public_project_intelligence():
    """Return the cached read-only intelligence report for the public /stats page."""
    return await asyncio.to_thread(get_project_intelligence)


@app.post("/api/sonar/project-intelligence/reanalyze", tags=["Sonar Project Intelligence"])
async def reanalyze_sonar_project_intelligence(current_user: dict = Depends(get_current_user)):
    """Force a source-tree walk after a code change."""
    return await asyncio.to_thread(get_project_intelligence, True)


@app.post("/api/sonar/project-intelligence/market/refresh", tags=["Sonar Project Intelligence"])
async def refresh_sonar_market_research(current_user: dict = Depends(get_current_user)):
    """Check the cached market sources without re-running the code analysis."""
    return await asyncio.to_thread(refresh_market_research)

@app.get("/api/events/live-pulse", tags=["Sonar Controller Compat"])
async def get_live_pulse(limit: int = 30, current_user: dict = Depends(get_current_user)):
    user_id = business_owner_id(current_user)
    return [
        event for event in LIVE_PULSE_EVENTS
        if is_event_visible_to_user(event, user_id)
    ][:max(1, min(limit, 50))]

@app.get("/api/logs", tags=["Sonar Controller Compat"])
async def get_system_logs(limit: int = 50, current_user: dict = Depends(get_current_user)):
    user_id = business_owner_id(current_user)
    return [
        event for event in SYSTEM_LOG_EVENTS
        if str(event.get("user_id") or "") == user_id
    ][:max(1, min(limit, 100))]

@app.get("/api/control-state", tags=["Sonar Controller Compat"])
async def get_control_state(current_user: dict = Depends(get_current_user)):
    return get_tenant_control_state(business_owner_id(current_user))

@app.get("/api/session", tags=["Sonar Controller Compat"])
async def get_session_state(current_user: dict = Depends(get_current_user)):
    return get_tenant_session_state(business_owner_id(current_user))

@app.get("/api/pipeline", tags=["Sonar Controller Compat"])
async def get_pipeline_state(current_user: dict = Depends(get_current_user)):
    business = load_business_by_user_id(business_owner_id(current_user))
    if not business:
        return {"stages": [], "totalRelics": 0, "qualifiedLeads": 0, "activeOutreach": 0}
    business_id = business.get("id")
    try:
        people = supabase.table('people').select('id').eq('business_id', business_id).execute().data or []
    except Exception:
        people = []
    try:
        appointments = supabase.table('appointments').select('id').eq('business_id', business_id).execute().data or []
    except Exception:
        appointments = []
    try:
        payments = supabase.table('payments').select('id').eq('business_id', business_id).execute().data or []
    except Exception:
        payments = []
    try:
        call_logs = supabase.table('call_logs').select('id').eq('user_id', business_owner_id(current_user)).execute().data or []
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
async def get_cron_jobs(current_user: dict = Depends(get_current_user)):
    user_id = business_owner_id(current_user)
    return [job for job in CRON_JOBS if str(job.get("user_id") or "") == user_id]

@app.post("/api/cron", tags=["Sonar Controller Compat"])
async def create_cron_job(job: dict, current_user: dict = Depends(get_current_user)):
    user_id = business_owner_id(current_user)
    cron_job = {
        "id": f"cron-{len(CRON_JOBS) + 1}",
        **job,
        "user_id": user_id,
    }
    CRON_JOBS.append(cron_job)
    push_live_event("Cron job created.", actor="system", severity="info", event_type="cron_created", payload=cron_job)
    return cron_job

@app.delete("/api/cron/{job_id}", tags=["Sonar Controller Compat"])
async def delete_cron_job(job_id: str, current_user: dict = Depends(get_current_user)):
    global CRON_JOBS
    user_id = business_owner_id(current_user)
    CRON_JOBS = [
        job for job in CRON_JOBS
        if job.get("id") != job_id or str(job.get("user_id") or "") != user_id
    ]
    push_live_event("Cron job deleted.", actor="system", severity="info", event_type="cron_deleted", payload={"id": job_id, "user_id": user_id})
    return {"ok": True}

@app.get("/api/reactions", tags=["Sonar Controller Compat"])
async def get_reactions(current_user: dict = Depends(get_current_user)):
    user_id = business_owner_id(current_user)
    try:
        return supabase.table('reactions').select('*').eq('user_id', user_id).execute().data or []
    except Exception:
        return [item for item in REACTIONS_CACHE if str(item.get("user_id") or "") == user_id]

@app.post("/api/reactions", tags=["Sonar Controller Compat"])
async def add_reaction(data: dict, current_user: dict = Depends(get_current_user)):
    user_id = business_owner_id(current_user)
    reaction_data = {**data, "user_id": user_id}
    try:
        response = supabase.table('reactions').insert(reaction_data).execute()
        created = response.data[0] if response.data else reaction_data
    except Exception:
        created = {"id": f"reaction-{len(REACTIONS_CACHE) + 1}", **reaction_data}
        REACTIONS_CACHE.append(created)
    push_live_event("Reaction recorded.", actor="system", severity="info", event_type="reaction_added", payload=created)
    return created

@app.get("/api/openrouter/models", tags=["Sonar Controller Compat"])
async def get_openrouter_models(current_user: dict = Depends(get_current_user)):
    return []

@app.get("/api/pending-restarts", tags=["Sonar Controller Compat"])
async def get_pending_restarts(current_user: dict = Depends(get_current_user)):
    user_id = business_owner_id(current_user)
    return [item for item in PENDING_RESTARTS if str(item.get("user_id") or "") == user_id]

@app.delete("/api/pending-restarts/{restart_id}", tags=["Sonar Controller Compat"])
async def clear_pending_restart(restart_id: str, current_user: dict = Depends(get_current_user)):
    global PENDING_RESTARTS
    user_id = business_owner_id(current_user)
    PENDING_RESTARTS = [
        item for item in PENDING_RESTARTS
        if item.get("id") != restart_id or str(item.get("user_id") or "") != user_id
    ]
    return {"ok": True}

@app.post("/api/agents/{agent_id}/call-types", tags=["Sonar Controller Compat"])
async def update_agent_call_types(agent_id: str, payload: AgentCallTypesRequest, current_user: dict = Depends(get_current_user)):
    current_user_id = business_owner_id(current_user)
    payload_dict = payload.model_dump() if hasattr(payload, "model_dump") else payload.dict()
    next_direction = normalize_receptionist_direction(
        payload_dict.get("direction")
        or payload_dict.get("call_routing")
        or payload_dict.get("calls")
        or "all"
    )
    existing_response = (
        supabase.table('hired_receptionists')
        .select('id,user_id,business_id,status,is_active,direction')
        .eq('id', agent_id)
        .eq('user_id', current_user_id)
        .limit(1)
        .execute()
    )
    existing_agent = (existing_response.data or [None])[0]
    if not existing_agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    next_status = derive_receptionist_status(
        existing_agent.get('status'),
        preserve_offline=False,
        direction=next_direction,
    )
    response = supabase.table('hired_receptionists').update({
        'direction': next_direction,
        'status': next_status,
    }).eq('id', agent_id).eq('user_id', current_user_id).execute()
    clear_conflicting_receptionist_directions(agent_id, existing_agent, next_direction)
    push_live_event("Agent call handling updated.", actor="system", severity="info", event_type="agent_updated", payload={"agent_id": agent_id, "direction": next_direction, "user_id": current_user_id})
    return response.data[0] if response.data else {"id": agent_id, "direction": next_direction, "status": next_status}

@app.post("/api/agents/{agent_id}/model", tags=["Sonar Controller Compat"])
async def update_agent_model(agent_id: str, payload: AgentModelRequest, current_user: dict = Depends(get_current_user)):
    current_user_id = business_owner_id(current_user)
    try:
        response = (
            supabase.table('hired_receptionists')
            .update({'model': payload.model})
            .eq('id', agent_id)
            .eq('user_id', current_user_id)
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
        updated = response.data[0]
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unable to update agent model")
    push_live_event("Agent model updated.", actor="system", severity="info", event_type="agent_updated", payload={"agent_id": agent_id, "model": payload.model, "user_id": current_user_id})
    return updated

@app.patch("/api/agents/{agent_id}", tags=["Sonar Controller Compat"])
async def patch_agent(agent_id: str, payload: dict, current_user: dict = Depends(get_current_user)):
    current_user_id = business_owner_id(current_user)
    existing_response = (
        supabase
        .table('hired_receptionists')
        .select('id,user_id,business_id,is_active,status,direction')
        .eq('id', agent_id)
        .eq('user_id', current_user_id)
        .limit(1)
        .execute()
    )
    existing_agent = (existing_response.data or [None])[0]
    if not existing_agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    allowed_fields = {"is_active", "status", "direction"}
    update_payload = {key: value for key, value in payload.items() if key in allowed_fields}
    if not update_payload:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No permitted agent fields supplied")
    if 'direction' in update_payload:
        update_payload['direction'] = normalize_receptionist_direction(update_payload.get('direction'))
        update_payload['status'] = derive_receptionist_status(
            existing_agent.get('status'),
            preserve_offline=False,
            direction=update_payload['direction'],
        )

    next_is_active = update_payload.get('is_active')
    if next_is_active is not None:
        next_is_active = bool(next_is_active)
        update_payload['is_active'] = next_is_active
        update_payload['status'] = derive_receptionist_status(
            existing_agent.get('status'),
            preserve_offline=False,
            direction=update_payload.get('direction', existing_agent.get('direction')),
        )

    response = (
        supabase.table('hired_receptionists')
        .update(update_payload)
        .eq('id', agent_id)
        .eq('user_id', current_user_id)
        .execute()
    )
    if 'direction' in update_payload:
        clear_conflicting_receptionist_directions(agent_id, existing_agent, update_payload.get('direction'))
    push_live_event("Agent updated.", actor="system", severity="info", event_type="agent_updated", payload={"agent_id": agent_id, "user_id": current_user_id, **update_payload})
    return response.data[0] if response.data else {"id": agent_id, **update_payload}

@app.delete("/api/agents/{agent_id}", tags=["Sonar Controller Compat"])
async def delete_agent(agent_id: str, current_user: dict = Depends(get_current_user)):
    current_user_id = business_owner_id(current_user)
    existing_response = (
        supabase
        .table('hired_receptionists')
        .select('id,user_id,full_name,first_name')
        .eq('id', agent_id)
        .eq('user_id', current_user_id)
        .limit(1)
        .execute()
    )
    existing_agent = (existing_response.data or [None])[0]
    if not existing_agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    linked_appointments = (
        supabase
        .table('appointments')
        .select('id')
        .eq('receptionist_id', agent_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if linked_appointments:
        archive_payload = {
            "is_active": False,
            "status": "archived",
            "direction": "none",
        }
        supabase.table('hired_receptionists').update(archive_payload).eq('id', agent_id).eq('user_id', current_user_id).execute()
        push_live_event(
            "Agent archived.",
            actor="system",
            severity="info",
            event_type="agent_archived",
            payload={
                "agent_id": agent_id,
                "user_id": current_user_id,
                "name": existing_agent.get('full_name') or existing_agent.get('first_name') or "Receptionist",
            },
        )
        return {"ok": True, "id": agent_id, "archived": True}

    supabase.table('hired_receptionists').delete().eq('id', agent_id).eq('user_id', current_user_id).execute()
    push_live_event(
        "Agent deleted.",
        actor="system",
        severity="info",
        event_type="agent_deleted",
        payload={
            "agent_id": agent_id,
            "user_id": current_user_id,
            "name": existing_agent.get('full_name') or existing_agent.get('first_name') or "Receptionist",
        },
    )
    return {"ok": True, "id": agent_id}

@app.post("/api/control/runtime", tags=["Sonar Controller Compat"])
async def set_runtime_mode(payload: RuntimeModeRequest, current_user: dict = Depends(get_current_user)):
    user_id = business_owner_id(current_user)
    control_state = get_tenant_control_state(user_id)
    session_state = get_tenant_session_state(user_id)
    control_state["runtime_mode"] = payload.mode
    session_state["status"] = payload.mode
    push_live_event(f"Runtime {payload.mode}.", actor="system", severity="info", event_type=f"runtime_{payload.mode}", payload={"mode": payload.mode, "user_id": user_id})
    return control_state

@app.post("/api/control/stage", tags=["Sonar Controller Compat"])
async def set_control_stage(payload: StageRequest, current_user: dict = Depends(get_current_user)):
    user_id = business_owner_id(current_user)
    control_state = get_tenant_control_state(user_id)
    control_state["stage"] = payload.stage
    push_live_event(f"Stage set to {payload.stage}.", actor="system", severity="info", event_type="stage_changed", payload={"stage": payload.stage, "user_id": user_id})
    return control_state

@app.post("/api/control/ping-max", tags=["Sonar Controller Compat"])
async def ping_max(current_user: dict = Depends(get_current_user)):
    user_id = business_owner_id(current_user)
    get_tenant_session_state(user_id)["last_ping_at"] = datetime.now(timezone.utc).isoformat()
    push_live_event("Ping sent.", actor="system", severity="info", event_type="ping_sent", payload={"user_id": user_id})
    return {"ok": True}

@app.post("/api/webhook/people", tags=["Sonar Controller Compat"])
async def people_webhook(payload: dict, current_user: dict = Depends(get_current_user)):
    event_type = payload.get("type", "people_update")
    record = payload.get("record") if isinstance(payload.get("record"), dict) else {}
    user_id = business_owner_id(current_user)
    push_live_event(
        f"People event: {event_type}.",
        actor="system",
        severity="info",
        event_type=f"lead_{str(event_type).lower()}",
        payload={"user_id": user_id, "record_id": record.get("id")},
    )
    return {"ok": True}

@app.get("/api/sonar/business/profile", tags=["Sonar Business"])
async def get_sonar_business_profile(current_user: dict = Depends(get_current_user)):
    business = load_business_by_user_id(business_owner_id(current_user))
    if not business:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    return serialize_business_profile_row(business)

@app.put("/api/sonar/business/profile", tags=["Sonar Business"])
async def update_sonar_business_profile(payload: dict, current_user: dict = Depends(get_current_user)):
    business = load_business_by_user_id(business_owner_id(current_user))
    if not business:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")

    allowed_fields = {
        "name", "phone", "email", "avatar", "address", "city", "state", "zip", "website",
        "about_us", "policies", "faq", "business_hours", "business_timezone", "industry",
    }
    updates = {key: value for key, value in payload.items() if key in allowed_fields}
    if "business_hours" in updates and isinstance(updates["business_hours"], (dict, list)):
        updates["business_hours"] = json.dumps(updates["business_hours"])
    if "industry" in updates and isinstance(updates["industry"], (dict, list)):
        updates["industry"] = updates["industry"]

    response = supabase.table("businesses").update(updates).eq("id", business["id"]).execute()
    updated = response.data[0] if response.data else {**business, **updates}
    return serialize_business_profile_row(updated)

@app.post("/api/sonar/business/avatar", tags=["Sonar Business"])
async def upload_sonar_business_avatar(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    content_type = (file.content_type or "").lower()
    allowed_content_types = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
    }
    if content_type not in allowed_content_types:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Upload a JPEG, PNG, WEBP, or GIF image.")

    business = load_business_by_user_id(business_owner_id(current_user))
    if not business:
        response = (
            supabase_admin.table("businesses")
            .insert({"user_id": business_owner_id(current_user)})
            .execute()
        )
        business = response.data[0] if getattr(response, "data", None) else None
    if not business:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not create business record.")

    content = await file.read(5*1024*1024+1)
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Image must be 5MB or smaller.")

    from .upload_validation import normalize_avatar
    try: content=normalize_avatar(content)
    except Exception: raise HTTPException(400,'Use a valid PNG, JPEG or WebP image under 5 MB')
    content_type='image/png'
    extension = 'png'
    storage_path = f"{current_user.id}/{business['id']}/avatar-{uuid4().hex}.{extension}"
    try:
        supabase_admin.storage.from_("business-avatars").upload(
            storage_path,
            content,
            file_options={
                "content-type": content_type,
                "cache-control": "3600",
                "upsert": "true",
            },
        )
        public_response = supabase_admin.storage.from_("business-avatars").get_public_url(storage_path)
        avatar_url = public_response if isinstance(public_response, str) else public_response.get("publicUrl")
        if not avatar_url:
            raise RuntimeError("Supabase did not return a public avatar URL.")
        update_response = (
            supabase_admin.table("businesses")
            .update({"avatar": avatar_url})
            .eq("id", business["id"])
            .eq("user_id", business_owner_id(current_user))
            .execute()
        )
        updated = update_response.data[0] if getattr(update_response, "data", None) else {**business, "avatar": avatar_url}
        return {"ok": True, "business": serialize_business_profile_row(updated), "avatar": avatar_url}
    except Exception as exc:
        logging.error('main.upload_sonar_business_avatar.event_8972')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to upload business avatar.") from exc

@app.post("/api/sonar/staff/avatar", tags=["Sonar Staff"])
async def upload_staff_avatar(file: UploadFile = File(...), current_user=Depends(get_current_user)):
    from .upload_validation import normalize_avatar
    tenant=current_tenant.get()
    if tenant is None: raise HTTPException(403,'Business authorization required')
    try:
        content=normalize_avatar(await file.read(5*1024*1024+1))
    except Exception:
        raise HTTPException(400,'Use a valid PNG, JPEG or WebP image under 5 MB')
    finally:
        await file.close()
    path=f'{tenant.owner_id}/{tenant.business_id}/avatar-{uuid4().hex}.png'
    storage=supabase_admin.storage.from_('staff-avatars')
    storage.upload(path,content,{'content-type':'image/png','upsert':'false'})
    url=storage.get_public_url(path)
    return {'url':url if isinstance(url,str) else url.get('publicUrl')}


@app.get("/api/sonar/people", tags=["Sonar People"])
async def list_sonar_people(limit: int = 100, current_user: dict = Depends(get_current_user)):
    business = load_business_by_user_id(business_owner_id(current_user))
    query = supabase.table("people").select("*")
    if business:
        query = query.eq("business_id", business["id"])
    else:
        query = query.eq("user_id", business_owner_id(current_user))
    response = query.order("created_at", desc=True).limit(max(1, min(limit, 500))).execute()
    return response.data or []


def serialize_sonar_person_document(row: dict, receptionist: Optional[dict] = None) -> dict:
    document = {
        "id": row.get("id"),
        "request_id": row.get("request_id"),
        "person_id": row.get("person_id"),
        "file_name": row.get("file_name") or "Document",
        "content_type": row.get("content_type") or "application/octet-stream",
        "file_size": row.get("file_size"),
        "created_at": row.get("created_at"),
    }
    if receptionist:
        document["receptionist"] = receptionist
    return document


class SonarDocumentRenameRequest(BaseModel):
    file_name: str = Field(..., min_length=1, max_length=255)


class SonarBugReportRequest(BaseModel):
    description: str = Field(..., min_length=1, max_length=10000)
    severity: int = Field(default=3, ge=1, le=5)
    page: Optional[str] = Field(default=None, max_length=120)


def normalize_sonar_document_name(file_name: str) -> str:
    """Keep dashboard document names safe for display without changing storage paths."""
    normalized = " ".join(str(file_name or "").replace("\\", "/").split("/")[-1].split())
    if not normalized or normalized in {".", ".."}:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Enter a valid document name")
    return normalized[:255]


def attach_document_receptionists(documents: list[dict], *, user_id: str, business_id) -> list[dict]:
    """Resolve a document request's conversation to the receptionist who handled it."""
    request_ids = [str(row.get("request_id")) for row in documents if row.get("request_id")]
    if not request_ids:
        return documents
    try:
        request_rows = (
            supabase_admin.table("requests")
            .select("id,metadata")
            .eq("business_id", business_id)
            .in_("id", request_ids)
            .execute()
            .data
            or []
        )
        conversation_by_request_id = {
            str(row.get("id")): str((row.get("metadata") or {}).get("conversation_id") or "").strip()
            for row in request_rows
        }
        receptionist_id_by_request_id = {
            str(row.get("id")): str((row.get("metadata") or {}).get("hired_receptionist_id") or "").strip()
            for row in request_rows
        }
        conversation_ids = list({value for value in conversation_by_request_id.values() if value})
        call_rows = []
        if conversation_ids:
            call_rows = (
                supabase_admin.table("call_logs")
                .select("conversation_id,hired_receptionist_id,elevenlabs_agent_id,created_at")
                .eq("user_id", user_id)
                .in_("conversation_id", conversation_ids)
                .order("created_at", desc=True)
                .execute()
                .data
                or []
            )
        receptionist_id_by_conversation = {}
        agent_id_by_conversation = {}
        for call in call_rows:
            conversation_id = str(call.get("conversation_id") or "").strip()
            receptionist_id = call.get("hired_receptionist_id")
            if conversation_id and receptionist_id and conversation_id not in receptionist_id_by_conversation:
                receptionist_id_by_conversation[conversation_id] = str(receptionist_id)
            agent_id = str(call.get("elevenlabs_agent_id") or "").strip()
            if conversation_id and agent_id and conversation_id not in agent_id_by_conversation:
                agent_id_by_conversation[conversation_id] = agent_id
        receptionist_ids = list(set([
            *receptionist_id_by_conversation.values(),
            *[value for value in receptionist_id_by_request_id.values() if value],
        ]))
        agent_ids = list(set(agent_id_by_conversation.values()))
        receptionist_rows = []
        if receptionist_ids:
            receptionist_rows.extend(
                supabase_admin.table("hired_receptionists")
                .select("id,full_name,avatar,catalog_id,elevenlabs_voice_id")
                .eq("user_id", user_id)
                .in_("id", receptionist_ids)
                .execute()
                .data
                or []
            )
        fallback_receptionist_id = None
        fallback_rows = (
            supabase_admin.table("hired_receptionists")
            .select("id,full_name,avatar,catalog_id,elevenlabs_voice_id,direction,is_active,status")
            .eq("business_id", business_id)
            .eq("user_id", user_id)
            .execute()
            .data
            or []
        )
        eligible_fallback_rows = [
            row for row in fallback_rows
            if receptionist_direction_allows("inbound", row.get("direction"))
            and row.get("is_active") is not False
            and str(row.get("status") or "").strip().lower() not in {"offline", "disabled", "inactive"}
        ]
        if len(eligible_fallback_rows) == 1:
            fallback_receptionist_id = str(eligible_fallback_rows[0].get("id"))
            if not any(str(row.get("id")) == fallback_receptionist_id for row in receptionist_rows):
                receptionist_rows.append(eligible_fallback_rows[0])
        if not receptionist_rows:
            return documents
        if agent_ids:
            receptionist_rows.extend(
                supabase_admin.table("hired_receptionists")
                .select("id,full_name,avatar,catalog_id,elevenlabs_voice_id")
                .eq("user_id", user_id)
                .in_("elevenlabs_voice_id", agent_ids)
                .execute()
                .data
                or []
            )
        catalog_ids = [str(row.get("catalog_id")) for row in receptionist_rows if row.get("catalog_id")]
        catalog_by_id = {}
        if catalog_ids:
            catalog_rows = (
                supabase_admin.table("receptionist_catalog")
                .select("id,banner_id,avatar")
                .in_("id", catalog_ids)
                .execute()
                .data
                or []
            )
            catalog_by_id = {str(row.get("id")): row for row in catalog_rows}
        receptionist_by_id = {}
        receptionist_id_by_agent_id = {}
        for receptionist in receptionist_rows:
            catalog = catalog_by_id.get(str(receptionist.get("catalog_id"))) or {}
            receptionist_by_id[str(receptionist.get("id"))] = {
                "id": receptionist.get("id"),
                "name": receptionist.get("full_name") or "Receptionist",
                "avatar": receptionist.get("avatar") or catalog.get("avatar"),
                "banner_id": catalog.get("banner_id"),
            }
            if receptionist.get("elevenlabs_voice_id"):
                receptionist_id_by_agent_id[str(receptionist["elevenlabs_voice_id"])] = str(receptionist.get("id"))

        for document in documents:
            conversation_id = conversation_by_request_id.get(str(document.get("request_id")))
            receptionist_id = (
                receptionist_id_by_request_id.get(str(document.get("request_id")))
                or receptionist_id_by_conversation.get(conversation_id)
                or receptionist_id_by_agent_id.get(agent_id_by_conversation.get(conversation_id))
            )
            is_fallback = False
            if not receptionist_id and fallback_receptionist_id:
                receptionist_id = fallback_receptionist_id
                is_fallback = True
            if receptionist_id in receptionist_by_id:
                document["receptionist"] = {
                    **receptionist_by_id[receptionist_id],
                    "attribution": "current_inbound_assignment" if is_fallback else "conversation",
                }
    except Exception as exc:
        logging.warning('main.attach_document_receptionists.event_9156')
    return documents


@app.get("/api/sonar/people/documents", tags=["Sonar People"])
async def list_sonar_people_documents(current_user: dict = Depends(get_current_user)):
    business = load_business_by_user_id(business_owner_id(current_user))
    if not business:
        return []
    try:
        response = (
            supabase_admin.table("people_docs")
            .select("id,request_id,person_id,file_name,content_type,file_size,created_at")
            .eq("business_id", business["id"])
            .order("created_at", desc=True)
            .limit(1000)
            .execute()
        )
        documents = attach_document_receptionists(
            response.data or [],
            user_id=business_owner_id(current_user),
            business_id=business["id"],
        )
        return [serialize_sonar_person_document(row, row.get("receptionist")) for row in documents]
    except Exception as exc:
        logging.error('main.list_sonar_people_documents.event_9181')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not load documents.") from exc


@app.get("/api/sonar/people/{person_id}/documents/{document_id}/url", tags=["Sonar People"])
async def get_sonar_person_document_url(person_id: str, document_id: UUID, current_user: dict = Depends(get_current_user)):
    # The existing dashboard already uses the authorized blob download route.
    # Never mint a reusable storage capability for newly encrypted content.
    business = load_business_by_user_id(business_owner_id(current_user))
    if not business:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    try:
        response = (
            supabase_admin.table("people_docs")
            .select("id,person_id,file_name,content_type,storage_bucket,storage_path")
            .eq("id", str(document_id))
            .eq("person_id", person_id)
            .eq("business_id", business["id"])
            .limit(1)
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
        document = response.data[0]
        if document.get("storage_bucket") != DOCUMENT_BUCKET or not document.get("storage_path"):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document file is unavailable")
        return {
            "url": f"/api/sonar/people/{person_id}/documents/{document_id}/download",
            "requires_authorization": True,
            "document": serialize_sonar_person_document(document),
        }
    except HTTPException:
        raise
    except Exception as exc:
        logging.error('main.get_sonar_person_document_url.event_9221')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not open document.") from exc


@app.get("/api/sonar/people/{person_id}/documents/{document_id}/download", tags=["Sonar People"])
async def download_person_document(person_id: str, document_id: UUID, current_user=Depends(get_current_user)):
    business = require_business_for_user(business_owner_id(current_user))
    rows = supabase_admin.table("people_docs").select("storage_bucket,storage_path,content_type,file_size").eq("id",str(document_id)).eq("person_id",person_id).eq("business_id",business["id"]).limit(1).execute().data
    if not rows or rows[0].get("storage_bucket") != DOCUMENT_BUCKET:
        raise HTTPException(404,"Document unavailable")
    row=rows[0]
    if int(row.get("file_size") or 0)>10*1024*1024: raise HTTPException(413,"Document too large")
    content=supabase_admin.storage.from_(DOCUMENT_BUCKET).download(row["storage_path"])
    if len(content)>15*1024*1024: raise HTTPException(413,"Document too large")
    from .envelope import open_file, MAGIC, KeyUnavailable
    if row['storage_path'].endswith('.ndmenc') and not content.startswith(MAGIC): raise KeyUnavailable()
    content=open_file(getattr(supabase_admin,'raw',supabase_admin),content,business_id=business['id'],bucket=DOCUMENT_BUCKET,path=row['storage_path'])
    if len(content)>10*1024*1024: raise HTTPException(413,"Document too large")
    media=row.get("content_type")
    if media not in {"application/pdf","image/jpeg","image/png","image/webp"}: media="application/octet-stream"
    return Response(content=content,media_type=media,headers={"Content-Disposition":'attachment; filename="document"',"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"})


@app.put("/api/sonar/people/{person_id}/documents/{document_id}", tags=["Sonar People"])
async def rename_sonar_person_document(
    person_id: str,
    document_id: str,
    payload: SonarDocumentRenameRequest,
    current_user: dict = Depends(get_current_user),
):
    business = load_business_by_user_id(business_owner_id(current_user))
    if not business:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    file_name = normalize_sonar_document_name(payload.file_name)
    try:
        response = (
            supabase_admin.table("people_docs")
            .update({"file_name": file_name})
            .eq("id", document_id)
            .eq("person_id", person_id)
            .eq("business_id", business["id"])
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
        return {"document": serialize_sonar_person_document(response.data[0])}
    except HTTPException:
        raise
    except Exception as exc:
        logging.error('main.rename_sonar_person_document.event_9251')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not rename document.") from exc


@app.delete("/api/sonar/people/{person_id}/documents/{document_id}", tags=["Sonar People"])
async def delete_sonar_person_document(person_id: str, document_id: str, current_user: dict = Depends(get_current_user)):
    business = load_business_by_user_id(business_owner_id(current_user))
    if not business:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    try:
        response = (
            supabase_admin.table("people_docs")
            .select("id,person_id,storage_bucket,storage_path")
            .eq("id", document_id)
            .eq("person_id", person_id)
            .eq("business_id", business["id"])
            .limit(1)
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
        document = response.data[0]
        if document.get("storage_bucket") == DOCUMENT_BUCKET and document.get("storage_path"):
            supabase_admin.storage.from_(DOCUMENT_BUCKET).remove([document["storage_path"]])
        (
            supabase_admin.table("people_docs")
            .delete()
            .eq("id", document_id)
            .eq("person_id", person_id)
            .eq("business_id", business["id"])
            .execute()
        )
        return {"ok": True, "id": document_id}
    except HTTPException:
        raise
    except Exception as exc:
        logging.error('main.delete_sonar_person_document.event_9287')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not delete document.") from exc


@app.post("/api/sonar/bugs", tags=["Sonar Feedback"])
async def create_sonar_bug_report(
    payload: SonarBugReportRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    user_id = business_owner_id(current_user)
    business = load_business_by_user_id(user_id)
    if not business:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    description = payload.description.strip()
    if not description:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Describe the problem before submitting")
    try:
        response = (
            supabase_admin.table("bugs")
            .insert({
                "user_id": user_id,
                "business_id": business["id"],
                "description": description,
                "severity": payload.severity,
                "page": (payload.page or "").strip()[:120] or None,
                "user_agent": request.headers.get("user-agent"),
            })
            .execute()
        )
        if not response.data:
            raise RuntimeError("Bug report was not created.")
        return {"ok": True, "bug": response.data[0]}
    except HTTPException:
        raise
    except Exception as exc:
        logging.error('main.create_sonar_bug_report.event_9305')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not submit the problem report.") from exc

@app.get("/api/sonar/people/search", tags=["Sonar People"])
async def search_sonar_people(q: str, limit: int = 25, current_user: dict = Depends(get_current_user)):
    rows = await list_sonar_people(limit=200, current_user=current_user)
    query_text = (q or "").strip().lower()
    if not query_text:
        return rows[:limit]
    matches = []
    for row in rows:
        searchable = " ".join(
            str(value) for value in [
                row.get("first_name"),
                row.get("last_name"),
                row.get("phone"),
                row.get("email"),
                row.get("notes"),
            ] if value
        ).lower()
        if query_text in searchable:
            matches.append(row)
    return matches[:max(1, min(limit, 100))]

@app.get("/api/sonar/people/{person_id}", tags=["Sonar People"])
async def get_sonar_person(person_id: str, current_user: dict = Depends(get_current_user)):
    business = load_business_by_user_id(business_owner_id(current_user))
    query = supabase.table("people").select("*").eq("id", person_id)
    if business:
        query = query.eq("business_id", business["id"])
    else:
        query = query.eq("user_id", business_owner_id(current_user))
    response = query.limit(1).execute()
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")
    return response.data[0]

@app.post("/api/sonar/people", tags=["Sonar People"])
async def create_sonar_person(payload: dict, current_user: dict = Depends(get_current_user)):
    business = require_business_for_user(business_owner_id(current_user))
    user_id = business_owner_id(current_user)
    context = require_plan_access(user_id, "contacts")
    enforce_plan_limit(
        context,
        "contacts",
        count_user_rows("people", user_id, business_id=(business or {}).get("id")),
        "max_contacts",
    )
    insert_payload = {
        key: value for key, value in payload.items()
        if key not in {"id", "user_id", "business_id", "created_at", "encryption_record_id", "security_revision"}
    }
    insert_payload["user_id"] = user_id
    if business:
        insert_payload["business_id"] = business["id"]
    insert_payload = normalize_people_payload_custom_fields(
        insert_payload,
        (business or {}).get("id") or insert_payload.get("business_id"),
    )
    response = supabase.table("people").insert(insert_payload).execute()
    created = response.data[0] if response.data else insert_payload
    claim_nest_milestone(
        supabase,
        business_id=created.get("business_id") or (business or {}).get("id"),
        user_id=created.get("user_id") or user_id,
        milestone_key="first_person_added",
        title="First person added",
        message=" ".join(part for part in (created.get("first_name"), created.get("last_name")) if part),
        source_id=created.get("id"),
    )
    schedule_backend_scenario_execution("record_created", {
        "record_id": created.get("id"),
        "person_id": created.get("id"),
        "user_id": created.get("user_id") or business_owner_id(current_user),
        "business_id": created.get("business_id") or (business or {}).get("id"),
        "person": created,
        "record": created,
    })
    return created

@app.put("/api/sonar/people/{person_id}", tags=["Sonar People"])
async def update_sonar_person(person_id: str, payload: dict, current_user: dict = Depends(get_current_user)):
    try:
        business = load_business_by_user_id(business_owner_id(current_user))
        existing_query = supabase.table("people").select("*").eq("id", person_id)
        if business:
            existing_query = existing_query.eq("business_id", business["id"])
        else:
            existing_query = existing_query.eq("user_id", business_owner_id(current_user))
        existing_response = existing_query.limit(1).execute()
        if not existing_response.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")

        updates = {
            key: value
            for key, value in payload.items()
            if key not in {"id", "user_id", "business_id", "created_at", "encryption_record_id", "security_revision"}
        }
        updates = normalize_people_payload_custom_fields(
            updates,
            (business or {}).get("id") or existing_response.data[0].get("business_id"),
            existing_response.data[0].get("custom_fields"),
        )
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()

        supabase.table("people").update(updates).eq("id", person_id).execute()

        refreshed_query = supabase.table("people").select("*").eq("id", person_id)
        if business:
            refreshed_query = refreshed_query.eq("business_id", business["id"])
        else:
            refreshed_query = refreshed_query.eq("user_id", business_owner_id(current_user))
        refreshed_response = refreshed_query.limit(1).execute()
        updated = refreshed_response.data[0] if refreshed_response.data else {**existing_response.data[0], **updates}
    except HTTPException:
        raise
    except Exception as exc:
        logging.error('main.update_sonar_person.event_9419')
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='The request could not be completed',
        ) from exc

    try:
        schedule_backend_scenario_execution("record_updated", {
            "record_id": updated.get("id") or person_id,
            "person_id": updated.get("id") or person_id,
            "user_id": updated.get("user_id") or existing_response.data[0].get("user_id") or business_owner_id(current_user),
            "business_id": updated.get("business_id") or existing_response.data[0].get("business_id") or (business or {}).get("id"),
            "person": updated,
            "record": updated,
        })
    except Exception as exc:
        logging.error('main.update_sonar_person.event_9435')

    return updated

@app.delete("/api/sonar/people/{person_id}", tags=["Sonar People"])
async def delete_sonar_person(person_id: str, current_user: dict = Depends(get_current_user)):
    business = load_business_by_user_id(business_owner_id(current_user))
    existing_query = supabase.table("people").select("id").eq("id", person_id)
    if business:
        existing_query = existing_query.eq("business_id", business["id"])
    else:
        existing_query = existing_query.eq("user_id", business_owner_id(current_user))
    existing_response = existing_query.limit(1).execute()
    if not existing_response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")

    deleted = existing_response.data[0]
    supabase.table("people").delete().eq("id", person_id).execute()
    schedule_backend_scenario_execution("record_deleted", {
        "record_id": person_id,
        "person_id": person_id,
        "user_id": deleted.get("user_id") or business_owner_id(current_user),
        "business_id": deleted.get("business_id") or (business or {}).get("id"),
        "person": deleted,
        "record": deleted,
    })
    return {"ok": True, "id": person_id}

@app.get("/api/sonar/services", tags=["Sonar Services"])
async def list_sonar_services(current_user: dict = Depends(get_current_user)):
    business = load_business_by_user_id(business_owner_id(current_user))
    if not business:
        return []
    query = supabase.table("services").select("*").eq("business_id", business["id"])
    response = query.order("category").order("sort_order").execute()
    return response.data or []


@app.get("/api/sonar/staff", tags=["Sonar Staff"])
async def list_sonar_staff(active_only: bool = True, current_user: dict = Depends(get_current_user)):
    business = load_business_by_user_id(business_owner_id(current_user))
    if not business:
        return []
    query = supabase.table("staff").select("*").eq("business_id", business["id"])
    if active_only:
        query = query.eq("is_active", True)
    response = query.order("full_name").limit(200).execute()
    return response.data or []

@app.post("/api/sonar/services", tags=["Sonar Services"])
async def create_sonar_service(payload: dict, current_user: dict = Depends(get_current_user)):
    business = require_business_for_user(business_owner_id(current_user))
    insert_payload = {key: value for key, value in payload.items() if key not in {"id", "user_id", "business_id"}}
    insert_payload["business_id"] = business["id"]
    response = supabase.table("services").insert(insert_payload).execute()
    return response.data[0] if response.data else insert_payload

@app.get("/api/sonar/appointments", tags=["Sonar Appointments"])
async def list_sonar_appointments(limit: int = 100, current_user: dict = Depends(get_current_user)):
    business = load_business_by_user_id(business_owner_id(current_user))
    if not business:
        return []
    query = supabase.table("appointments").select("id,date,time,duration,status,source,notes,person_id,service_id,staff_id,business_id,receptionist_id,created_at,updated_at")
    query = query.eq("business_id", business["id"])
    response = query.order("date").order("time").limit(max(1, min(limit, 500))).execute()
    return response.data or []


@app.post("/api/sonar/appointments", tags=["Sonar Appointments"])
async def create_sonar_appointment(payload: dict, current_user: dict = Depends(get_current_user)):
    business = load_business_by_user_id(business_owner_id(current_user))
    if not business:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")

    appointment_date = normalize_appointment_date_value(first_present(payload, "date", "appointment_date"))
    appointment_time = normalize_appointment_time_value(first_present(payload, "time", "appointment_time"))
    appointment_duration = normalize_appointment_duration(first_present(payload, "duration", "appointment_duration"))
    person_id = safe_appointment_person_id(first_present(payload, "person_id"), business_id=(business or {}).get("id"))
    requested_staff_id = first_present(payload, "staff_id")
    staff_id = safe_appointment_staff_id(requested_staff_id, business_id=business["id"], require_active=False)
    if requested_staff_id is not None and staff_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Staff member not found")

    schedule_valid, schedule_reason, schedule_conflicts = validate_appointment_schedule(
        business,
        appointment_date,
        appointment_time,
        appointment_duration,
        staff_id=staff_id,
    )
    if not schedule_valid:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"reason": schedule_reason, "conflicts": schedule_conflicts},
        )

    appointment_row = {
        "date": appointment_date,
        "time": appointment_time,
        "duration": appointment_duration,
        "status": normalize_appointment_status(first_present(payload, "status")),
        "receptionist_id": int_or_none(first_present(payload, "receptionist_id", "hired_receptionist_id")),
        "notes": first_present(payload, "notes"),
        "person_id": person_id,
        "service_id": safe_appointment_service_id(first_present(payload, "service_id"), business_id=(business or {}).get("id")),
        "staff_id": staff_id,
        "business_id": business["id"],
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if first_present(payload, "source") is not None:
        appointment_row["source"] = first_present(payload, "source")
    response = supabase.table("appointments").insert(appointment_row).execute()
    created = response.data[0] if response.data else appointment_row
    claim_nest_milestone(
        supabase,
        business_id=created.get("business_id") or business.get("id"),
        user_id=business_owner_id(current_user),
        milestone_key="first_appointment_booked",
        title="First appointment booked",
        message=" · ".join(part for part in (created.get("date"), created.get("time")) if part),
        source_id=created.get("id"),
    )
    appointment_business_id = created.get("business_id") or business.get("id")
    appointment_status = str(created.get("status") or "").strip().lower()
    if appointment_status == "completed":
        claim_nest_milestone(
            supabase,
            business_id=appointment_business_id,
            user_id=business_owner_id(current_user),
            milestone_key="first_appointment_completed",
            title="First appointment completed",
            message=" · ".join(part for part in (created.get("date"), created.get("time")) if part),
            source_id=created.get("id"),
        )
    try:
        receptionist_id = created.get("receptionist_id")
        if receptionist_id is not None:
            receptionist_bookings = (
                supabase.table("appointments")
                .select("id")
                .eq("business_id", appointment_business_id)
                .eq("receptionist_id", receptionist_id)
                .limit(2)
                .execute()
                .data
                or []
            )
            if len(receptionist_bookings) == 1:
                claim_nest_milestone(
                    supabase,
                    business_id=appointment_business_id,
                    user_id=business_owner_id(current_user),
                    milestone_key="first_receptionist_booking",
                    title="First receptionist booking",
                    message=" · ".join(part for part in (created.get("date"), created.get("time")) if part),
                    source_id=created.get("id"),
                )
        person_id = created.get("person_id")
        if person_id is not None:
            person_appointments = (
                supabase.table("appointments")
                .select("id")
                .eq("business_id", appointment_business_id)
                .eq("person_id", person_id)
                .limit(2)
                .execute()
                .data
                or []
            )
            if len(person_appointments) == 2:
                claim_nest_milestone(
                    supabase,
                    business_id=appointment_business_id,
                    user_id=business_owner_id(current_user),
                    milestone_key="first_repeat_customer",
                    title="First repeat customer",
                    message=str(person_id),
                    source_id=created.get("id"),
                )
        appointment_source = str(created.get("source") or "").strip().lower()
        if appointment_source in {"scenario", "automation", "automated", "workflow"}:
            claim_nest_milestone(
                supabase,
                business_id=appointment_business_id,
                user_id=business_owner_id(current_user),
                milestone_key="first_automated_booking",
                title="First automated booking",
                message=" · ".join(part for part in (created.get("date"), created.get("time")) if part),
                source_id=created.get("id"),
            )
    except Exception as exc:
        logging.warning('main.create_sonar_appointment.event_9626')
    emit_scenario_trigger(
        "appointment_created",
        {
            "appointment": created,
            "appointment_id": created.get("id"),
            "person_id": created.get("person_id"),
            "service_id": created.get("service_id"),
            "staff_id": created.get("staff_id"),
            "business_id": business["id"],
        },
    )
    emit_appointment_change_triggers(None, created, business_id=business["id"], include_updated=False)
    return created


@app.put("/api/sonar/appointments/{appointment_id}", tags=["Sonar Appointments"])
async def update_sonar_appointment(appointment_id: str, payload: dict, current_user: dict = Depends(get_current_user)):
    appointment_id = uuid_or_none(appointment_id)
    if not appointment_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid appointment ID")

    business = require_business_for_user(business_owner_id(current_user))
    existing_query = supabase.table("appointments").select("*").eq("id", appointment_id).eq("business_id", business["id"])
    existing_response = existing_query.limit(1).execute()
    if not existing_response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")

    updates = {}
    if first_present(payload, "date", "appointment_date") is not None:
        updates["date"] = normalize_appointment_date_value(first_present(payload, "date", "appointment_date"))
    if first_present(payload, "time", "appointment_time") is not None:
        updates["time"] = normalize_appointment_time_value(first_present(payload, "time", "appointment_time"))
    if first_present(payload, "duration", "appointment_duration") is not None:
        updates["duration"] = normalize_appointment_duration(first_present(payload, "duration", "appointment_duration"))
    if first_present(payload, "status") is not None:
        updates["status"] = normalize_appointment_status(first_present(payload, "status"))
    if first_present(payload, "receptionist_id", "hired_receptionist_id") is not None:
        updates["receptionist_id"] = int_or_none(first_present(payload, "receptionist_id", "hired_receptionist_id"))
    if first_present(payload, "notes") is not None:
        updates["notes"] = first_present(payload, "notes")
    if first_present(payload, "person_id") is not None:
        safe_person_id = safe_appointment_person_id(first_present(payload, "person_id"), business_id=(business or {}).get("id"))
        if safe_person_id is not None:
            updates["person_id"] = safe_person_id
    if first_present(payload, "service_id") is not None:
        safe_service_id = safe_appointment_service_id(first_present(payload, "service_id"), business_id=(business or {}).get("id"))
        if safe_service_id is not None:
            updates["service_id"] = safe_service_id
    if first_present(payload, "staff_id") is not None:
        safe_staff_id = safe_appointment_staff_id(
            first_present(payload, "staff_id"),
            business_id=(business or {}).get("id") or existing_response.data[0].get("business_id"),
            require_active=False,
        )
        if safe_staff_id is not None:
            updates["staff_id"] = safe_staff_id
    if not updates:
        return {"ok": True, "appointment": {"id": appointment_id, "action": "update_appointment", "skipped": True, "reason": "No valid appointment fields to update"}}

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    response = supabase.table("appointments").update(updates).eq("id", appointment_id).eq("business_id", business["id"]).execute()
    updated = response.data[0] if response.data else {**existing_response.data[0], **updates}
    if str(updated.get("status") or "").strip().lower() == "completed":
        claim_nest_milestone(
            supabase,
            business_id=updated.get("business_id") or (business or {}).get("id"),
            user_id=business_owner_id(current_user),
            milestone_key="first_appointment_completed",
            title="First appointment completed",
            message=" · ".join(part for part in (updated.get("date"), updated.get("time")) if part),
            source_id=updated.get("id") or appointment_id,
        )
    emit_appointment_change_triggers(
        existing_response.data[0],
        updated,
        business_id=updated.get("business_id") or (business or {}).get("id"),
    )
    return updated


@app.delete("/api/sonar/appointments/{appointment_id}", tags=["Sonar Appointments"])
async def delete_sonar_appointment(appointment_id: str, current_user: dict = Depends(get_current_user)):
    appointment_id = uuid_or_none(appointment_id)
    if not appointment_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid appointment ID")

    business = require_business_for_user(business_owner_id(current_user))
    query = supabase.table("appointments").select("id").eq("id", appointment_id).eq("business_id", business["id"])
    existing_response = query.limit(1).execute()
    if not existing_response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")

    supabase.table("appointments").delete().eq("id", appointment_id).eq("business_id", business["id"]).execute()
    return {"ok": True, "id": appointment_id, "action": "delete_appointment"}


@app.get("/api/sonar/appointments/stats", tags=["Sonar Appointments"])
async def get_sonar_appointment_stats(current_user: dict = Depends(get_current_user)):
    appointments = await list_sonar_appointments(limit=1000, current_user=current_user)
    counts = defaultdict(int)
    for row in appointments:
        counts[str(row.get("status") or "unknown").lower()] += 1
    return {
        "total": len(appointments),
        "by_status": dict(counts),
    }

@app.get("/api/sonar/receptionists/hired", tags=["Sonar Receptionists"])
async def list_hired_receptionists(current_user: dict = Depends(get_current_user)):
    response = (
        supabase.table("hired_receptionists")
        .select("*")
        .eq("user_id", business_owner_id(current_user))
        .order("hired_at", desc=True)
        .execute()
    )
    return response.data or []


def normalize_custom_voice_receptionist(row: dict) -> dict:
    metadata = row.get("metadata") if isinstance(row.get("metadata"), dict) else {}
    profile = metadata.get("receptionist_profile") if isinstance(metadata.get("receptionist_profile"), dict) else {}
    voice_name = profile.get("full_name") or row.get("voice_name") or row.get("speaker_name") or "Cloned Voice"
    first_name = profile.get("first_name") or (str(voice_name).strip().split(" ")[0] if str(voice_name).strip() else "Voice")
    last_name = profile.get("last_name")
    if not last_name and str(voice_name).strip() and " " in str(voice_name).strip():
        last_name = " ".join(str(voice_name).strip().split(" ")[1:])
    traits = profile.get("traits") if isinstance(profile.get("traits"), list) else ["Voice Clone", "Custom"]
    return {
        "id": f"voice-clone:{row.get('id')}",
        "source": "voice_clone",
        "custom_voice_id": row.get("id"),
        "provider_voice_id": row.get("provider_voice_id"),
        "elevenlabs_voice_id": row.get("provider_voice_id"),
        "full_name": voice_name,
        "first_name": first_name,
        "last_name": last_name,
        "description": profile.get("description") or "Custom cloned voice.",
        "stereotype": profile.get("stereotype") or "Custom Voice Clone",
        "avatar": profile.get("avatar") or profile.get("profile_image"),
        "traits": traits,
        "voice": profile.get("voice"),
        "age": profile.get("age"),
        "gender": profile.get("gender"),
        "is_active": True,
    }


@app.post("/api/sonar/receptionists/hire", tags=["Sonar Receptionists"])
async def hire_receptionist(payload: dict, current_user: dict = Depends(get_current_user)):
    catalog_id = payload.get("catalog_id") or payload.get("id")
    custom_voice_id = payload.get("custom_voice_id") or payload.get("voice_clone_id")
    source = str(payload.get("source") or "").strip().lower()
    is_voice_clone_hire = source in {"voice_clone", "custom_voice"} or bool(custom_voice_id)
    if not catalog_id and not custom_voice_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="catalog_id is required")

    current_user_id = business_owner_id(current_user)
    plan_context = require_plan_access(current_user_id, "receptionists")
    enforce_plan_limit(
        plan_context,
        "receptionists",
        count_active_receptionists(current_user_id),
        "max_receptionists",
    )
    try:
        if is_voice_clone_hire:
            voice_response = (
                supabase.table("custom_voices")
                .select("*")
                .eq("id", str(custom_voice_id or str(catalog_id).replace("voice-clone:", "", 1)))
                .limit(1)
                .execute()
            )
            catalog_row = (voice_response.data or [None])[0]
            if not catalog_row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voice clone not found")
            if not catalog_row.get("provider_voice_id"):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Voice clone is missing a voice id")
            owner_id = catalog_row.get("user_id")
            if owner_id and str(owner_id) != current_user_id:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voice clone not found")
        else:
            catalog_response = (
                supabase.table("receptionist_catalog")
                .select("*")
                .eq("id", str(catalog_id))
                .limit(1)
                .execute()
            )
            catalog_row = (catalog_response.data or [None])[0]
            if not catalog_row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Catalog receptionist not found")

        business_response = (
            supabase.table("businesses")
            .select("id")
            .eq("user_id", current_user_id)
            .limit(1)
            .execute()
        )
        business_row = (business_response.data or [None])[0]

        if is_voice_clone_hire:
            normalized = normalize_custom_voice_receptionist(catalog_row)
            insert_payload = {
                "catalog_id": None,
                "full_name": normalized.get("full_name"),
                "description": normalized.get("description"),
                "stereotype": normalized.get("stereotype"),
                "avatar": normalized.get("avatar"),
                "traits": normalized.get("traits"),
                "voice": normalized.get("voice"),
                "age": normalized.get("age"),
                "first_name": normalized.get("first_name"),
                "gender": normalized.get("gender"),
                "is_active": True,
                "direction": "all",
                "user_id": current_user_id,
                "business_id": business_row.get("id") if business_row else None,
                "elevenlabs_voice_id": catalog_row.get("provider_voice_id"),
            }
        else:
            insert_payload = {
                "catalog_id": catalog_row.get("id"),
                "full_name": catalog_row.get("full_name"),
                "description": catalog_row.get("description"),
                "stereotype": catalog_row.get("stereotype"),
                "avatar": catalog_row.get("avatar"),
                "traits": catalog_row.get("traits"),
                "voice": catalog_row.get("voice"),
                "age": catalog_row.get("age"),
                "first_name": catalog_row.get("first_name"),
                "gender": catalog_row.get("gender"),
                "is_active": True,
                "direction": "all",
                "user_id": current_user_id,
                "business_id": business_row.get("id") if business_row else None,
                "elevenlabs_voice_id": catalog_row.get("elevenlabs_voice_id") or catalog_row.get("elevenlabs_agent_id"),
            }
        response = supabase.table("hired_receptionists").insert(insert_payload).execute()
        created = response.data[0] if response.data else insert_payload
        claim_nest_milestone(
            supabase,
            business_id=created.get("business_id") or (business_row or {}).get("id"),
            user_id=created.get("user_id") or current_user_id,
            milestone_key="first_receptionist_hired",
            title="First receptionist hired",
            message=created.get("full_name") or created.get("first_name") or "",
            source_id=created.get("id"),
        )
        push_live_event(
            "Agent hired.",
            actor="system",
            severity="info",
            event_type="agent_created",
            payload={"agent_id": created.get("id"), "user_id": current_user_id},
        )
        return created
    except HTTPException:
        raise
    except Exception as exc:
        logging.error('main.hire_receptionist.event_9889')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to hire receptionist")

@app.get("/api/sonar/receptionists/catalog", tags=["Sonar Receptionists"])
async def list_receptionist_catalog(current_user: dict = Depends(get_current_user)):
    response = (
        supabase.table("receptionist_catalog")
        .select("*")
        .order("full_name")
        .execute()
    )
    catalog_rows = response.data or []
    clone_rows = []
    try:
        custom_voice_response = (
            supabase.table("custom_voices")
            .select("id,user_id,provider_voice_id,voice_name,speaker_name,status,created_at,metadata")
            .in_("status", ["ready", "requires_verification"])
            .not_.is_("provider_voice_id", "null")
            .or_(f"user_id.eq.{current_user.id},user_id.is.null")
            .order("created_at", desc=True)
            .execute()
        )
        for row in custom_voice_response.data or []:
            clone_rows.append(normalize_custom_voice_receptionist(row))
    except Exception as exc:
        logging.warning('main.list_receptionist_catalog.event_9915')
    return [*catalog_rows, *clone_rows]

@app.get("/api/sonar/call-logs", tags=["Sonar Calls"])
async def list_call_logs(
    limit: int = 50,
    offset: int = 0,
    q: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    safe_limit = max(1, min(limit, 200))
    safe_offset = max(0, offset)
    query = (
        supabase.table("call_logs")
        .select("id,business_id,user_id,caller_name,caller_phone,from_number,started_at,event_timestamp,created_at,duration_seconds,status,outcome,summary,call_successful,direction,receptionist_name,agent_name,hired_receptionist_id,is_favorited,has_audio")
        .eq("user_id", business_owner_id(current_user))
        .order("created_at", desc=True)
        .range(safe_offset, safe_offset + safe_limit - 1)
    )
    search_query = (q or "").strip()
    if search_query:
        escaped_query = search_query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_").replace(",", "\\,")
        pattern = f"%{escaped_query}%"
        query = query.or_(
            ",".join([
                f"caller_name.ilike.{pattern}",
                f"caller_phone.ilike.{pattern}",
                f"from_number.ilike.{pattern}",
                f"summary.ilike.{pattern}",
                f"notes.ilike.{pattern}",
                f"outcome.ilike.{pattern}",
                f"status.ilike.{pattern}",
                f"call_successful.ilike.{pattern}",
                f"agent_name.ilike.{pattern}",
                f"receptionist_name.ilike.{pattern}",
            ])
        )
    response = query.execute()
    rows = response.data or []
    for row in rows:
        enrich_call_log_with_person(
            row,
            payload_data=row.get("raw_payload") if isinstance(row.get("raw_payload"), dict) else {},
            business_id=row.get("business_id"),
            user_id=business_owner_id(current_user),
        )
        row["receptionist_avatar"] = None
        if row.get("hired_receptionist_id"):
            try:
                receptionist_response = (
                    supabase.table("hired_receptionists")
                    .select("avatar")
                    .eq("id", str(row["hired_receptionist_id"]))
                    .limit(1)
                    .execute()
                )
                if receptionist_response.data:
                    row["receptionist_avatar"] = receptionist_response.data[0].get("avatar")
            except Exception as exc:
                logging.warning('main.list_call_logs.event_9975')
    return rows


@app.post("/api/sonar/call-logs/search", tags=["Sonar Calls"])
async def search_call_logs(payload: dict, current_user=Depends(get_current_user)):
    return await list_call_logs(limit=int(payload.get("limit",20)), offset=int(payload.get("offset",0)), q=str(payload.get("q", ""))[:200], current_user=current_user)


@app.get("/api/sonar/call-logs/{call_log_id}/details", tags=["Sonar Calls"])
async def call_log_details(call_log_id: UUID, current_user=Depends(get_current_user)):
    business = require_business_for_user(business_owner_id(current_user))
    row = supabase.table("call_logs").select("id,transcript_jsonb,transcript_text,call_report").eq("id",str(call_log_id)).eq("business_id",business["id"]).limit(1).execute().data
    if not row: raise HTTPException(404,"Call not found")
    return remove_secrets(row[0])


@app.post("/api/sonar/call-logs/{call_log_id}/playback", tags=["Sonar Calls"])
async def call_log_playback(call_log_id: UUID, current_user=Depends(get_current_user)):
    business = require_business_for_user(business_owner_id(current_user))
    rows = supabase.table("call_logs").select("id,audio_storage_path").eq("id",str(call_log_id)).eq("business_id",business["id"]).limit(1).execute().data
    if not rows or not rows[0].get("audio_storage_path"): raise HTTPException(404,"Recording unavailable")
    if rows[0]['audio_storage_path'].endswith('.ndmenc'):
        return {'url': f'/api/sonar/call-logs/{call_log_id}/audio', 'requires_authorization': True}
    url = storage_signed_url(rows[0]["audio_storage_path"], expires_in=60)
    if not url: raise HTTPException(503,"Recording unavailable")
    return {"url":url,"expires_in_seconds":60}


@app.get('/api/sonar/call-logs/{call_log_id}/audio', tags=['Sonar Calls'])
async def call_log_audio(call_log_id: UUID, current_user=Depends(get_current_user)):
    business = require_business_for_user(business_owner_id(current_user))
    rows = supabase.table('call_logs').select('id,audio_storage_path').eq('id',str(call_log_id)).eq('business_id',business['id']).limit(1).execute().data
    if not rows or not rows[0].get('audio_storage_path'): raise HTTPException(404,'Recording unavailable')
    path = rows[0]['audio_storage_path']
    content = supabase_admin.storage.from_('call_recordings').download(path)
    from .envelope import open_file, MAGIC, KeyUnavailable
    if len(content) > 180*1024*1024: raise HTTPException(413,'Recording too large')
    if path.endswith('.ndmenc') and not content.startswith(MAGIC): raise KeyUnavailable()
    content = open_file(getattr(supabase_admin,'raw',supabase_admin),content,business_id=business['id'],bucket='call_recordings',path=path)
    return Response(content=content,media_type='audio/mpeg',headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'})


@app.post("/api/sonar/call-logs/delete", tags=["Sonar Calls"])
async def delete_call_logs(payload: dict, current_user: dict = Depends(get_current_user)):
    ids = payload.get("ids") if isinstance(payload, dict) else None
    if not isinstance(ids, list) or not ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ids array is required")

    normalized_ids = [str(item).strip() for item in ids if str(item).strip()]
    if not normalized_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No valid call log ids provided")

    existing = (
        supabase.table("call_logs")
        .select("id")
        .eq("user_id", business_owner_id(current_user))
        .in_("id", normalized_ids)
        .execute()
    )
    matched_ids = [str(row.get("id")) for row in (existing.data or []) if row.get("id")]
    if not matched_ids:
        return {"ok": True, "deleted_ids": [], "deleted_count": 0}

    supabase.table("call_logs").delete().eq("user_id", business_owner_id(current_user)).in_("id", matched_ids).execute()
    return {"ok": True, "deleted_ids": matched_ids, "deleted_count": len(matched_ids)}

@app.patch("/api/sonar/call-logs/{call_log_id}/favorite", tags=["Sonar Calls"])
async def update_call_log_favorite(call_log_id: str, payload: dict, current_user: dict = Depends(get_current_user)):
    if not isinstance(payload, dict) or "is_favorited" not in payload:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="is_favorited is required")

    is_favorited = bool(payload.get("is_favorited"))
    response = (
        supabase.table("call_logs")
        .update({"is_favorited": is_favorited})
        .eq("user_id", business_owner_id(current_user))
        .eq("id", str(call_log_id))
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call log not found")
    return {"ok": True, "call_log": {"id":response.data[0]["id"], "is_favorited":is_favorited}}

@app.get("/api/sonar/call-logs/stats", tags=["Sonar Calls"])
async def get_call_log_stats(current_user: dict = Depends(get_current_user)):
    rows = _fetch_call_log_rows(user_id=business_owner_id(current_user))
    overall_metrics = _accumulate_receptionist_metrics(rows)

    by_receptionist = {}
    for row in rows:
        receptionist_key = row.get("hired_receptionist_id") or row.get("receptionist_name") or "unknown"
        bucket = by_receptionist.setdefault(
            receptionist_key,
            {
                "hired_receptionist_id": row.get("hired_receptionist_id"),
                "receptionist_name": row.get("receptionist_name"),
                "rows": [],
            },
        )
        bucket["rows"].append(row)

    receptionist_metrics = []
    for bucket in by_receptionist.values():
        metrics = _accumulate_receptionist_metrics(bucket["rows"])
        receptionist_metrics.append(
            {
                "hired_receptionist_id": bucket["hired_receptionist_id"],
                "receptionist_name": bucket["receptionist_name"],
                **metrics,
            }
        )

    return {
        **overall_metrics,
        "completed_calls": overall_metrics["completed_calls_count"],
        "failed_calls": overall_metrics["failed_calls_count"],
        "missed_calls": overall_metrics["missed_calls_count"],
        "inbound_calls": overall_metrics["inbound_calls_count"],
        "outbound_calls": overall_metrics["outbound_calls_count"],
        "by_receptionist": receptionist_metrics,
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
        logging.error('main.get_queue_messages.event_10113')
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
        logging.error('main.delete_message.event_10133')
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
        logging.error('main.update_message_status.event_10167')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update message status.")

# --- Authentication Endpoint ---
@app.post("/token", response_model=TokenResponse, tags=["Authentication"])
async def login_for_access_token(form_data: AuthLoginRequest):
    try:
        response = new_auth_client().auth.sign_in_with_password({"email": form_data.email, "password": form_data.password})
        if response.session:
            return response.session.model_dump()
        else:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Login failed: No session returned.")
    except AuthApiError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='The request could not be completed', headers={"WWW-Authenticate": "Bearer"})
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='The request could not be completed')

# --- Breakroom (Reps) Endpoints ---
@app.post("/breakroom/login", response_model=RepTokenResponse, tags=["Reps"])
async def login_for_rep_access_token(form_data: RepLoginRequest):
    logging.info('main.login_for_rep_access_token.event_10344')
    try:
        logging.info('main.login_for_rep_access_token.event_10254')
        rep_response = supabase.table('reps').select('*').eq('rep_id', form_data.rep_id).single().execute()
        
        if not rep_response.data:
            logging.warning('main.login_for_rep_access_token.event_10193')
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rep ID not found.")
        
        logging.info('main.login_for_rep_access_token.event_10261')
        rep = rep_response.data
        
        received_password = form_data.password
        db_password = rep.get('rep_password')
        
        logging.info('main.login_for_rep_access_token.event_10267')
        
        passwords_match = received_password == db_password
        
        if not passwords_match:
            logging.warning('main.login_for_rep_access_token.event_10207')
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect password.")

        logging.info('main.login_for_rep_access_token.event_10275')
        access_token_expires = timedelta(minutes=60)
        access_token = create_access_token(
            data={"sub": rep.get('rep_id')}, expires_delta=access_token_expires
        )
        
        logging.info('main.login_for_rep_access_token.event_10281')
        return {"access_token": access_token, "token_type": "bearer"}

    except HTTPException as e:
        # Re-raising HTTPException to let FastAPI handle it, no extra logging needed here.
        raise e
    except Exception as e:
        logging.error('main.login_for_rep_access_token.event_10223')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An internal error occurred.")

@app.get("/reps/me", response_model=RepResponse, tags=["Reps"])
async def read_current_rep(current_rep_id: str = Depends(get_current_rep)):
    try:
        response = supabase.table('reps').select('*').eq('rep_id', current_rep_id).single().execute()
        if not response.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Current rep's profile not found.")
        return RepResponse.model_validate(response.data).model_dump()
    except Exception as e:
        logging.error('main.read_current_rep.event_10234')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='The request could not be completed')

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
        logging.error('main.deduct_rep_points.event_10261')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='The request could not be completed')

@app.get("/money-table", response_model=List[MoneyTablePlan], tags=["Reps"])
async def get_money_table_data(current_rep: str = Depends(get_current_rep)):
    try:
        # 1. Fetch all data
        plans_response = supabase.table('plans').select('slug,name').execute()
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
            plan_name = plan['slug']
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
                plan_label=plan.get('name', plan_name.capitalize()),
                total_annual_payouts=total_monthly_commission * 12,
                reps=plan_reps
            ))
            
        return money_table_data

    except Exception as e:
        logging.error('main.get_money_table_data.event_10312')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve money table data.")



# --- Billing Endpoints ---
@app.get("/plans", tags=["Billing"])
async def get_plans():
    try:
        is_payment_test_mode()
        products = stripe.Product.list(active=True, limit=100)
        prices = stripe.Price.list(active=True, limit=100)
        return {"products": products.data, "prices": prices.data}
    except Exception as e:
        logging.error('main.get_plans.event_10326')
        raise HTTPException(status_code=500, detail="Failed to fetch plans")


@app.get("/api/sonar/pricing/plans", tags=["Sonar Payments"])
async def get_sonar_pricing_plans():
    stripe_data = await get_plans()
    try:
        plan_rows = (
            supabase_admin.table("plans")
            .select("slug,name,stripe_product_name,sort_order,is_recommended,display,entitlements,features")
            .eq("is_public", True)
            .order("sort_order")
            .execute()
        ).data or []
    except Exception as e:
        # Keep Stripe pricing available while the optional entitlement table is being deployed.
        logging.warning('main.get_sonar_pricing_plans.event_10343')
        plan_rows = []

    return {**stripe_data, "plans": plan_rows}

@app.post("/create-checkout-session", tags=["Billing"])
async def create_checkout_session(request: CreateCheckoutSessionRequest, current_user: dict = Depends(get_current_user)):
  current_user_id = current_user.id
  test_mode = is_payment_test_mode()
  try:
    plan_slug, billing_cycle = _resolve_checkout_plan(request, test_mode)
    if not test_mode:
      try:
        requested_price = stripe.Price.retrieve(request.price_id)
        requested_product = stripe.Product.retrieve(requested_price.get("product"))
      except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The selected Stripe price is not available.") from exc
      if not requested_price.get("active") or not requested_price.get("recurring"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The selected Stripe price is not an active subscription price.")
      if str(requested_product.get("name") or "").strip().lower() != plan_slug:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The selected Stripe price does not match the selected plan.")

    try:
      user_profile = supabase.table('users').select('email', 'stripe_customer_id').eq('id', str(current_user_id)).single().execute()
    except APIError as exc:
      error_payload = getattr(exc, "args", [None])[0]
      if isinstance(error_payload, dict) and error_payload.get("code") == "42703":
        raise HTTPException(
          status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
          detail="Database migration missing: run sql/add_user_billing_columns.sql in Supabase before using billing.",
        ) from exc
      raise
    if not user_profile.data:
      raise HTTPException(status_code=404, detail="User not found")
    
    customer_id = user_profile.data.get('stripe_customer_id')
    user_email = user_profile.data.get('email')

    if test_mode:
      customer_id = customer_id if str(customer_id or "").startswith("sim_cus_") else _simulated_id("cus")
      subscription = _apply_simulated_subscription(
        str(current_user_id), plan_slug, billing_cycle, customer_id
      )
      session_id = _simulated_id("cs")
      base_url = get_payment_frontend_base_url().rstrip('/')
      return {
        "sessionId": session_id,
        "url": f"{base_url}/dashboard?payment=simulated&session_id={session_id}&plan={plan_slug}",
        "simulated": True,
        "charged": False,
        "mode": "test",
        "subscription": serialize_stripe_subscription(subscription),
      }

    if not customer_id:
      customer = stripe.Customer.create(email=user_email, metadata={'supabase_user_id': str(current_user_id)})
      customer_id = customer.id
      supabase.table('users').update({'stripe_customer_id': customer_id}).eq('id', str(current_user_id)).execute()

    # Dynamically set the base URL based on TEST_MODE
    if test_mode:
        base_url = frontend_base_url or "http://localhost:5173"
    else:
        base_url = frontend_base_url or "https://nodemere.ai"

    price_to_use = request.price_id
    checkout_session_data = {
      'customer': customer_id,
      # The new Stripe account has Managed Payments enabled by default. Keep
      # the existing card-only Checkout flow valid by opting out per session.
      'managed_payments': {'enabled': False},
      'line_items': [{'price': price_to_use, 'quantity': 1}],
      'mode': 'subscription',
      'allow_promotion_codes': True,
      'subscription_data': {'metadata': {'supabase_user_id': str(current_user_id)}},
      'success_url': f'{base_url}/dashboard?session_id={{CHECKOUT_SESSION_ID}}',
      'cancel_url': f'{base_url}/pricing?canceled=true',
    }

    checkout_session = stripe.checkout.Session.create(**checkout_session_data)


    return {"sessionId": checkout_session.id, "url": checkout_session.url}

  except stripe.error.InvalidRequestError as e:
    if "No such customer" in str(e):
      logging.warning('main.create_checkout_session.event_10429')
      supabase.table('users').update({'stripe_customer_id': None}).eq('id', str(current_user_id)).execute()
      return await create_checkout_session(request, current_user)
    else:
      logging.error('main.create_checkout_session.event_10433')
      raise HTTPException(status_code=500, detail='The request could not be completed')
  except Exception as e:
    logging.error('main.create_checkout_session.event_10436')
    raise HTTPException(status_code=500, detail="An internal error occurred.")


@app.post("/api/sonar/billing/portal", tags=["Billing"])
async def create_billing_portal_session(current_user: dict = Depends(get_current_user)):
    user_id = business_owner_id(current_user)
    if is_payment_test_mode():
        base_url = get_payment_frontend_base_url().rstrip('/')
        return {
            "url": f"{base_url}/dashboard?billing=simulated",
            "simulated": True,
            "charged": False,
            "mode": "test",
        }
    profile_response = (
        supabase_admin.table("users")
        .select("email,stripe_customer_id")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    profile = (profile_response.data or [None])[0]
    customer_id = (profile or {}).get("stripe_customer_id")
    if not customer_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "billing_customer_missing", "message": "Start a subscription before opening Billing Portal."},
        )

    return_url = f"{(frontend_base_url or 'http://localhost:5173').rstrip('/')}/dashboard"
    try:
        portal_session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=return_url,
        )
    except stripe.error.InvalidRequestError as exc:
        logging.warning('main.create_billing_portal_session.event_10473')
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "billing_customer_invalid", "message": "Billing Portal is not available for this account yet."},
        ) from exc
    except Exception as exc:
        logging.error('main.create_billing_portal_session.event_10479')
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Could not open Stripe Billing Portal.") from exc
    return {"url": portal_session.url}


@app.get("/api/sonar/billing/usage", tags=["Billing"])
async def get_billing_usage(current_user: dict = Depends(get_current_user)):
    usage = get_usage_snapshot(business_owner_id(current_user))
    recent_events = []
    try:
        recent_events = (
            supabase_admin.table("billing_overage_events")
            .select("stripe_invoice_id,billable_minutes,amount_cents,currency,status,error_message,created_at,reconciled_at")
            .eq("user_id", business_owner_id(current_user))
            .order("created_at", desc=True)
            .limit(5)
            .execute()
        ).data or []
    except Exception as exc:
        logging.warning('main.get_billing_usage.event_10498')
    return {**usage, "recent_overage_events": recent_events}

@app.get("/api/sonar/payments/test-mode", tags=["Sonar Payments"])
async def get_sonar_payment_test_mode():
    test_mode = is_payment_test_mode()
    return {
        "testMode": test_mode,
        "enabled": test_mode,
        "mode": get_payment_mode_label(),
    }


@app.post("/api/sonar/payments/test-mode", tags=["Sonar Payments"])
async def set_sonar_payment_test_mode(
    request: PaymentTestModeRequest,
    _internal: None = Depends(require_internal_tool_authorization),
):
    set_payment_test_mode(request.enabled)
    test_mode = is_payment_test_mode()
    return {
        "testMode": test_mode,
        "enabled": test_mode,
        "mode": get_payment_mode_label(),
    }

@app.post("/api/sonar/create-payment", tags=["Sonar Payments"])
async def create_payment(
    request: PaymentCreateRequest,
    current_user: dict = Depends(get_current_user),
):
    return await _create_payment_for_user(request, business_owner_id(current_user))


@app.post("/api/sonar/create-customer", tags=["Sonar Payments"])
async def create_customer(
    request: CustomerCreateRequest,
    current_user: dict = Depends(get_current_user),
):
    return await _create_customer_for_user(request, business_owner_id(current_user))


@app.post("/api/sonar/call-customer", tags=["Sonar Calls"])
async def call_customer(payload: dict, current_user: dict = Depends(get_current_user)):
    ensure_no_unresolved_templates(
        payload.get("person_id"),
        payload.get("to_phone"),
        payload.get("main_content"),
    )

    user_id = business_owner_id(current_user)
    business = load_business_by_user_id(user_id)
    enforce_call_minutes(user_id, business, direction="outbound")
    receptionist = find_inbound_receptionist_for_business(
        (business or {}).get("id"),
        user_id,
    )

    person = None
    person_id = payload.get("person_id")
    if person_id:
        person_response = (
            supabase.table("people")
            .select("*")
            .eq("id", str(person_id))
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        person = (person_response.data or [None])[0]
        if not person:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")

    node = {
        "id": "builder-call-customer",
        "actionConfig": {
            "_key": "call_customer",
            "to_phone": payload.get("to_phone") or "",
            "main_content": payload.get("main_content") or "",
        },
    }
    context = {
        "user_id": user_id,
        "business": business or {},
        "business_id": (business or {}).get("id"),
        "receptionist": receptionist or {},
        "person": person or {},
        "customer": person or {},
        "_scenario": {},
    }

    result = await scenario_engine.action_executor._call_customer(node, context)
    if not result.get("success"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='The request could not be completed')
    return result.get("data") or {}


async def _create_customer_for_user(request: CustomerCreateRequest, user_id: str):
    require_payment_access(user_id)
    ensure_no_unresolved_templates(request.person_id, request.customer_name, request.customer_email, request.customer_phone)
    customer, _person = create_or_update_stripe_customer_for_user(
        user_id=user_id,
        person_id=request.person_id,
        customer_name=request.customer_name,
        customer_email=request.customer_email,
        customer_phone=request.customer_phone,
        create_if_missing=True,
    )
    return serialize_stripe_customer(customer)


@app.post("/api/sonar/update-customer", tags=["Sonar Payments"])
async def update_customer(
    request: CustomerUpdateRequest,
    current_user: dict = Depends(get_current_user),
):
    return await _update_customer_for_user(request, business_owner_id(current_user))


async def _update_customer_for_user(request: CustomerUpdateRequest, user_id: str):
    require_payment_access(user_id)
    ensure_no_unresolved_templates(request.customer_id, request.person_id, request.customer_name, request.customer_email, request.customer_phone)
    customer, _person = create_or_update_stripe_customer_for_user(
        user_id=user_id,
        customer_id=request.customer_id,
        person_id=request.person_id,
        customer_name=request.customer_name,
        customer_email=request.customer_email,
        customer_phone=request.customer_phone,
        create_if_missing=False,
    )
    return serialize_stripe_customer(customer)


async def _create_payment_for_user(request: PaymentCreateRequest, user_id: str):
    require_payment_access(user_id)
    description = "Business payment"
    payment_method_type = (request.payment_method_type or "card").lower()
    payment_method = "us_bank_account" if payment_method_type == "ach" else payment_method_type
    ensure_no_unresolved_templates(
        request.person_id,
        request.appointment_id,
        request.customer_id,
        request.customer_name,
        request.customer_email,
        request.customer_phone,
        description,
    )
    business = load_business_by_user_id(user_id)
    if not business:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    if is_payment_test_mode():
        customer = create_or_update_stripe_customer_for_user(
            user_id=user_id,
            customer_id=request.customer_id,
            person_id=request.person_id,
            customer_name=request.customer_name,
            customer_email=request.customer_email,
            customer_phone=request.customer_phone,
            create_if_missing=True,
            appointment_id=request.appointment_id,
        )[0]
        payment_intent_id = _simulated_id("pi")
        payment_row = build_payment_row(
            amount=request.amount,
            currency=request.currency,
            payment_method=request.payment_method_type,
            description=description,
            status="succeeded",
            stripe_payment_intent_id=payment_intent_id,
            user_id=user_id,
            business_id=business.get("id"),
        )
        saved_payment = insert_payment_record(payment_row)
        emit_payment_trigger("payment_received", {
            "user_id": user_id,
            "business_id": business.get("id"),
            "payment": saved_payment,
            "payment_id": saved_payment.get("id"),
            "stripe_payment_intent_id": payment_intent_id,
            "customer_id": customer.get("id"),
            "amount": request.amount,
            "currency": request.currency,
            "status": "succeeded",
            "simulation": True,
        })
        return {
            **saved_payment,
            "client_secret": None,
            "status": "succeeded",
            "id": payment_intent_id,
            "object": "payment_intent",
            "amount": request.amount,
            "amount_received": request.amount,
            "currency": request.currency,
            "customer_id": customer.get("id"),
            "simulated": True,
            "charged": False,
        }

    customer, _person = create_or_update_stripe_customer_for_user(
        user_id=user_id,
        customer_id=request.customer_id,
        person_id=request.person_id,
        customer_name=request.customer_name,
        customer_email=request.customer_email,
        customer_phone=request.customer_phone,
        create_if_missing=True,
        appointment_id=request.appointment_id,
    )

    stripe_request_options = _get_connected_stripe_request_options(user_id)
    stripe_payment_intent = None
    try:
        payment_intent_payload = {
            "amount": request.amount,
            "currency": request.currency,
            "description": description,
            "payment_method_types": [payment_method],
            "automatic_payment_methods": {"enabled": False},
            "customer": customer.get("id"),
            "metadata": build_scenario_customer_metadata(
                user_id=user_id,
                person_id=request.person_id,
                appointment_id=request.appointment_id,
            ),
        }
        application_fee_amount = calculate_platform_application_fee(request.amount)
        if application_fee_amount:
            payment_intent_payload["application_fee_amount"] = application_fee_amount
        stripe_payment_intent = stripe.PaymentIntent.create(**stripe_request_options, **payment_intent_payload)
    except Exception as exc:
        logging.error('main._create_payment_for_user.event_10730')
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail='The request could not be completed') from exc

    stripe_payment_status = str(stripe_payment_intent.status if stripe_payment_intent else "created").lower()
    payment_record_status = (
        "succeeded"
        if stripe_payment_status == "succeeded"
        else "failed"
        if stripe_payment_status in {"canceled", "requires_payment_method"} and stripe_payment_intent.last_payment_error
        else "pending"
    )
    payment_row = build_payment_row(
        amount=request.amount,
        currency=request.currency,
        payment_method=request.payment_method_type,
        description=description,
        status=payment_record_status,
        stripe_payment_intent_id=(stripe_payment_intent.id if stripe_payment_intent else None),
        receipt_url=None,
        error_message=None,
        user_id=user_id,
        business_id=business.get("id"),
    )
    saved_payment = insert_payment_record(payment_row)

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
            "customer_id": customer.get("id"),
        })
    else:
        response_payload.update({
            "client_secret": None,
            "id": saved_payment.get("stripe_payment_intent_id") or saved_payment.get("id"),
            "object": "payment_record",
            "customer_id": customer.get("id"),
        })
    return response_payload

@app.post("/api/sonar/send-payment-link", tags=["Sonar Payments"])
async def send_payment_link(
    request: PaymentLinkCreateRequest,
    current_user: dict = Depends(get_current_user),
):
    return await _send_payment_link_for_user(request, business_owner_id(current_user))


@app.post("/api/sonar/create-payment-profile", tags=["Sonar Payments"])
async def create_payment_profile(
    request: PaymentLinkCreateRequest,
    current_user: dict = Depends(get_current_user),
):
    return await _send_payment_link_for_user(request, business_owner_id(current_user))


async def _send_payment_link_for_user(request: PaymentLinkCreateRequest, user_id: str):
    require_payment_access(user_id)
    description = "Business payment"
    payment_mode_base_url = get_payment_frontend_base_url()
    ensure_no_unresolved_templates(
        request.person_id,
        request.customer_id,
        request.customer_name,
        request.customer_email,
        request.customer_phone,
        description,
    )
    business = load_business_by_user_id(user_id)
    if not business:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    if is_payment_test_mode():
        customer, _person = create_or_update_stripe_customer_for_user(
            user_id=user_id,
            customer_id=request.customer_id,
            person_id=request.person_id,
            customer_name=request.customer_name,
            customer_email=request.customer_email,
            customer_phone=request.customer_phone,
            create_if_missing=True,
        )
        session_id = _simulated_id("cs")
        payment_row = build_payment_row(
            amount=request.amount,
            currency=request.currency,
            payment_method="link",
            description=description,
            status="succeeded",
            stripe_session_id=session_id,
            user_id=user_id,
            business_id=business.get("id"),
        )
        saved_payment = insert_payment_record(payment_row)
        payment_url = f"{payment_mode_base_url.rstrip('/')}/dashboard?payment=simulated&session_id={session_id}"
        emit_payment_trigger("payment_link_sent", {
            "user_id": user_id,
            "business_id": business.get("id"),
            "payment": saved_payment,
            "payment_id": saved_payment.get("id"),
            "stripe_session_id": session_id,
            "payment_url": payment_url,
            "customer_id": customer.get("id"),
            "amount": request.amount,
            "currency": request.currency,
            "status": "succeeded",
            "simulation": True,
        })
        return {
            "customer_id": customer.get("id"),
            "payment_url": payment_url,
            "amount": request.amount,
            "currency": request.currency,
            "status": "succeeded",
            "customer_name": request.customer_name,
            "customer_email": request.customer_email,
            "customer_phone": request.customer_phone,
            "stripe_session_id": session_id,
            "payment_id": saved_payment.get("id"),
            "simulated": True,
            "charged": False,
        }

    customer, _person = create_or_update_stripe_customer_for_user(
        user_id=user_id,
        customer_id=request.customer_id,
        person_id=request.person_id,
        customer_name=request.customer_name,
        customer_email=request.customer_email,
        customer_phone=request.customer_phone,
        create_if_missing=True,
    )
    stripe_request_options = _get_connected_stripe_request_options(user_id)
    payment_metadata = build_scenario_customer_metadata(user_id=user_id, person_id=request.person_id)
    try:

        payment_intent_data = {
            "metadata": payment_metadata,
        }
        application_fee_amount = calculate_platform_application_fee(request.amount)
        if application_fee_amount:
            payment_intent_data["application_fee_amount"] = application_fee_amount

        checkout_session = stripe.checkout.Session.create(
            **stripe_request_options,
            mode="payment",
            customer=customer.get("id"),
            line_items=[{
                "price_data": {
                    "currency": request.currency,
                    "product_data": {
                        "name": "Business payment",
                        **({"description": description} if description else {}),
                    },
                    "unit_amount": request.amount,
                },
                        "quantity": 1,
            }],
            payment_intent_data=payment_intent_data,
            success_url=f"{payment_mode_base_url}/dashboard?payment=success&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{payment_mode_base_url}/dashboard?payment=cancelled",
            metadata=payment_metadata,
        )

        payment_row = build_payment_row(
            amount=request.amount,
            currency=request.currency,
            payment_method="link",
            description=description,
            status="pending",
            stripe_session_id=checkout_session.id,
            user_id=user_id,
            business_id=business.get("id"),
        )
        saved_payment = insert_payment_record(payment_row)
        response_payload = {
            "customer_id": customer.get("id"),
            "payment_url": checkout_session.url,
            "amount": request.amount,
            "currency": request.currency,
            "status": "pending",
            "customer_name": request.customer_name,
            "customer_email": request.customer_email,
            "customer_phone": request.customer_phone,
            "stripe_session_id": checkout_session.id,
            "payment_id": saved_payment.get("id"),
        }
        emit_payment_trigger("payment_link_sent", {
            "user_id": user_id,
            "business_id": business.get("id"),
            "payment": saved_payment,
            "payment_id": saved_payment.get("id"),
            "stripe_session_id": checkout_session.id,
            "payment_url": checkout_session.url,
            "customer_id": customer.get("id"),
            "amount": request.amount,
            "currency": request.currency,
            "status": "pending",
        })
        return response_payload
    except Exception as exc:
        logging.error('main._send_payment_link_for_user.event_10939')
        raise HTTPException(status_code=500, detail='The request could not be completed')

@app.post("/api/sonar/create-invoice", tags=["Sonar Payments"])
async def create_invoice(
    request: InvoiceCreateRequest,
    current_user: dict = Depends(get_current_user),
):
    return await _create_invoice_for_user(request, business_owner_id(current_user))


async def _create_invoice_for_user(request: InvoiceCreateRequest, user_id: str):
    require_payment_access(user_id)
    description = "Business invoice"
    ensure_no_unresolved_templates(
        request.person_id,
        request.customer_id,
        request.appointment_id,
        request.service_id,
        request.customer_name,
        request.customer_email,
        request.customer_phone,
        description,
    )
    customer, _person = create_or_update_stripe_customer_for_user(
        user_id=user_id,
        customer_id=request.customer_id,
        person_id=request.person_id,
        customer_name=request.customer_name,
        customer_email=request.customer_email,
        customer_phone=request.customer_phone,
        create_if_missing=True,
        appointment_id=request.appointment_id,
        service_id=request.service_id,
    )
    if is_payment_test_mode():
        invoice_id = _simulated_id("in")
        now = int(datetime.now(timezone.utc).timestamp())
        invoice = {
            "id": invoice_id,
            "object": "invoice",
            "status": "draft",
            "amount_due": request.amount,
            "amount_paid": 0,
            "currency": request.currency,
            "customer": customer.get("id"),
            "description": description or "Invoice",
            "created": now,
            "due_date": now + max(int(request.due_days or 7), 1) * 86400,
            "metadata": {"simulation": "true", "user_id": user_id},
            "simulation": True,
        }
        payload = serialize_stripe_invoice(invoice)
        payload.update({"customer_id": customer.get("id"), "simulated": True, "charged": False})
        return payload

    stripe_request_options = _get_connected_stripe_request_options(user_id)
    try:
        invoice_metadata = build_invoice_metadata(
            person_id=request.person_id,
            appointment_id=request.appointment_id,
            service_id=request.service_id,
        )

        stripe.InvoiceItem.create(
            **stripe_request_options,
            customer=customer.get("id"),
            amount=request.amount,
            currency=request.currency,
            description=description or "Invoice",
            metadata=invoice_metadata,
        )

        invoice = stripe.Invoice.create(
            **stripe_request_options,
            customer=customer.get("id"),
            collection_method="send_invoice",
            days_until_due=max(int(request.due_days or 7), 1),
            auto_advance=False,
            pending_invoice_items_behavior="include",
            description=description or None,
            metadata=invoice_metadata,
            **({"application_fee_amount": calculate_platform_application_fee(request.amount)} if calculate_platform_application_fee(request.amount) else {}),
        )
        payload = serialize_stripe_invoice(invoice)
        payload["customer_id"] = customer.get("id")
        return payload
    except Exception as exc:
        logging.error('main._create_invoice_for_user.event_11027')
        raise HTTPException(status_code=500, detail='The request could not be completed')

@app.post("/api/sonar/send-invoice", tags=["Sonar Payments"])
async def send_invoice(
    request: InvoiceSendRequest,
    current_user: dict = Depends(get_current_user),
):
    return await _send_invoice_for_user(request, business_owner_id(current_user))


async def _send_invoice_for_user(request: InvoiceSendRequest, user_id: str):
    require_payment_access(user_id)
    ensure_no_unresolved_templates(request.invoice_id)
    if is_payment_test_mode():
        if not str(request.invoice_id or "").startswith("sim_in_"):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Simulated invoice not found.")
        now = int(datetime.now(timezone.utc).timestamp())
        invoice = {
            "id": request.invoice_id,
            "object": "invoice",
            "status": "open",
            "amount_due": 0,
            "amount_paid": 0,
            "currency": "usd",
            "created": now,
            "metadata": {"simulation": "true", "user_id": user_id},
            "simulation": True,
        }
        payload = serialize_stripe_invoice(invoice)
        payload.update({"simulated": True, "charged": False})
        return payload

    stripe_request_options = _get_connected_stripe_request_options(user_id)
    try:
        invoice = stripe.Invoice.retrieve(request.invoice_id, **stripe_request_options)
        if invoice.get("status") == "draft":
            invoice = stripe.Invoice.finalize_invoice(request.invoice_id, **stripe_request_options)

        stripe.Invoice.send_invoice(request.invoice_id, **stripe_request_options)

        fresh_invoice = stripe.Invoice.retrieve(request.invoice_id, **stripe_request_options)
        return serialize_stripe_invoice(fresh_invoice)
    except Exception as exc:
        logging.error('main._send_invoice_for_user.event_11071')
        raise HTTPException(status_code=500, detail='The request could not be completed')


@app.post("/api/sonar/refund-payment", tags=["Sonar Payments"])
async def refund_payment(
    request: RefundPaymentRequest,
    current_user: dict = Depends(get_current_user),
):
    return await _refund_payment_for_user(request, business_owner_id(current_user))


async def _refund_payment_for_user(request: RefundPaymentRequest, user_id: str):
    require_payment_access(user_id)
    ensure_no_unresolved_templates(request.payment_id, request.refund_reason)
    if is_payment_test_mode():
        payment_record = None
        if request.payment_id:
            response = (
                supabase_admin.table("payments")
                .select("*")
                .eq("user_id", user_id)
                .or_(f"stripe_payment_intent_id.eq.{request.payment_id},id.eq.{request.payment_id}")
                .limit(1)
                .execute()
            )
            payment_record = (response.data or [None])[0]
        if not payment_record:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
        payment_intent_id = payment_record.get("stripe_payment_intent_id") or request.payment_id
        refunded_amount = int(request.amount or payment_record.get("amount") or 0)
        update_payment_record(
            "id",
            payment_record.get("id"),
            {
                "status": "refunded",
                "refunded_amount": refunded_amount,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            user_id=user_id,
        )
        refund = {
            "id": _simulated_id("re"),
            "object": "refund",
            "payment_intent": payment_intent_id,
            "amount": refunded_amount,
            "currency": payment_record.get("currency") or "usd",
            "reason": "requested_by_customer" if request.refund_reason else None,
            "status": "succeeded",
            "created": int(datetime.now(timezone.utc).timestamp()),
            "metadata": {"user_id": user_id, "simulation": "true"},
            "simulation": True,
        }
        return {
            **serialize_stripe_refund(refund),
            "payment_id": payment_record.get("id"),
            "customer_id": None,
            "simulated": True,
            "charged": False,
        }

    stripe_request_options = _get_connected_stripe_request_options(user_id)

    payment_record = None
    if request.payment_id:
        existing = supabase.table("payments").select("*").eq("stripe_payment_intent_id", request.payment_id).eq("user_id", user_id).limit(1).execute()
        if existing.data:
            payment_record = existing.data[0]
        elif is_uuid_value(request.payment_id):
            existing = supabase.table("payments").select("*").eq("id", request.payment_id).eq("user_id", user_id).limit(1).execute()
            if existing.data:
                payment_record = existing.data[0]

    payment_intent_id = (
        (payment_record or {}).get("stripe_payment_intent_id")
        or request.payment_id
    )
    if not payment_intent_id:
        raise HTTPException(status_code=404, detail="Payment not found")

    try:
        refund = _stripe_object_to_dict(
            stripe.Refund.create(
                **stripe_request_options,
                payment_intent=payment_intent_id,
                **({"amount": request.amount} if request.amount else {}),
                **({"reason": "requested_by_customer"} if request.refund_reason else {}),
                metadata={"user_id": user_id, "source": "nodemere_scenarios"},
            )
        )
    except Exception as exc:
        logging.error('main._refund_payment_for_user.event_11162')
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail='The request could not be completed') from exc

    refunded_amount = int(refund.get("amount") or 0)
    current_amount = int((payment_record or {}).get("amount") or 0)
    next_status = "partial_refund" if current_amount and refunded_amount < current_amount else "refunded"
    customer_id = refund.get("customer")
    if not customer_id and payment_intent_id:
        try:
            customer_id = _stripe_object_to_dict(
                stripe.PaymentIntent.retrieve(payment_intent_id, **stripe_request_options)
            ).get("customer")
        except Exception:
            customer_id = None
    updated_payment = update_payment_record(
        "stripe_payment_intent_id",
        payment_intent_id,
        {
            "status": next_status,
            "refunded_amount": refunded_amount,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
        user_id=user_id,
    ) or payment_record or {}

    result = {
        **serialize_stripe_refund(refund),
        "payment_id": updated_payment.get("id") or request.payment_id,
        "customer_id": customer_id,
    }
    return result


@app.post("/api/sonar/cancel-subscription", tags=["Sonar Payments"])
async def cancel_subscription(
    request: CancelSubscriptionRequest,
    current_user: dict = Depends(get_current_user),
):
    return await _cancel_subscription_for_user(request, business_owner_id(current_user))


async def _cancel_subscription_for_user(request: CancelSubscriptionRequest, user_id: str):
    require_payment_access(user_id)
    ensure_no_unresolved_templates(request.subscription_id, request.customer_id, request.person_id)
    if is_payment_test_mode():
        profile_response = (
            supabase_admin.table("users")
            .select("stripe_subscription_id,stripe_customer_id,plan,subscription_status")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        profile = (profile_response.data or [None])[0] or {}
        subscription_id = request.subscription_id or profile.get("stripe_subscription_id")
        if not str(subscription_id or "").startswith("sim_sub_"):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No simulated active subscription found.")
        supabase_admin.table("users").update({
            "plan": "free",
            "subscription_status": "canceled",
            "billing_period": None,
            "source": None,
            "trial_start_date": None,
            "trial_end_date": None,
            "started_trial": False,
        }).eq("id", user_id).execute()
        sync_business_plan_entitlement(user_id, "free", reset_usage=False)
        subscription = {
            "id": subscription_id,
            "object": "subscription",
            "customer": profile.get("stripe_customer_id"),
            "status": "canceled",
            "cancel_at_period_end": False,
            "canceled_at": int(datetime.now(timezone.utc).timestamp()),
            "metadata": {"user_id": user_id, "simulation": "true"},
            "simulation": True,
        }
        result = serialize_stripe_subscription(subscription)
        result.update({"customer_id": subscription.get("customer"), "simulated": True, "charged": False})
        return result

    stripe_request_options = _get_connected_stripe_request_options(user_id)
    customer, _person = create_or_update_stripe_customer_for_user(
        user_id=user_id,
        customer_id=request.customer_id,
        person_id=request.person_id,
        create_if_missing=False,
    )

    subscription_id = request.subscription_id
    if not subscription_id:
        subscriptions = stripe.Subscription.list(
            **stripe_request_options,
            customer=customer.get("id"),
            status="all",
            limit=10,
        )
        match = next(
            (
                item for item in list(subscriptions.get("data") or [])
                if str(item.get("status") or "").lower() not in {"canceled", "incomplete_expired"}
            ),
            None,
        )
        subscription_id = match.get("id") if match else None

    if not subscription_id:
        raise HTTPException(status_code=404, detail="No active subscription found for this customer.")

    try:
        subscription = _stripe_object_to_dict(
            stripe.Subscription.cancel(subscription_id, **stripe_request_options)
        )
    except Exception as exc:
        logging.error('main._cancel_subscription_for_user.event_11275')
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail='The request could not be completed') from exc

    result = serialize_stripe_subscription(subscription)
    result["customer_id"] = subscription.get("customer")
    return result


@app.post("/api/sonar/send-email", tags=["Sonar Integrations"])
async def send_scenario_email(
    request: ScenarioSendEmailRequest,
    current_user: dict = Depends(get_current_user),
):
    ensure_no_unresolved_templates(request.to, request.subject, request.body)
    if not request.to or not request.subject:
        raise HTTPException(status_code=400, detail="Email recipient and subject are required.")
    result = _send_email_for_user(business_owner_id(current_user), request.to, request.subject, request.body or "")
    return {
        **result,
        "id": result.get("id"),
        "thread_id": result.get("thread_id") or result.get("threadId"),
        "label_ids": result.get("labelIds") or [],
    }


async def scenario_create_payment_callback(payload: dict):
    user_id = str(payload.pop("user_id", "") or "")
    if not user_id:
        raise HTTPException(status_code=400, detail="User ID is required for scenario payments.")
    request = PaymentCreateRequest(**payload)
    return await _create_payment_for_user(request, user_id)


async def scenario_create_customer_callback(payload: dict):
    user_id = str(payload.pop("user_id", "") or "")
    if not user_id:
        raise HTTPException(status_code=400, detail="User ID is required for scenario payments.")
    request = CustomerCreateRequest(**payload)
    return await _create_customer_for_user(request, user_id)


async def scenario_update_customer_callback(payload: dict):
    user_id = str(payload.pop("user_id", "") or "")
    if not user_id:
        raise HTTPException(status_code=400, detail="User ID is required for scenario payments.")
    request = CustomerUpdateRequest(**payload)
    return await _update_customer_for_user(request, user_id)


async def scenario_send_payment_link_callback(payload: dict):
    user_id = str(payload.pop("user_id", "") or "")
    if not user_id:
        raise HTTPException(status_code=400, detail="User ID is required for scenario payments.")
    request = PaymentLinkCreateRequest(**payload)
    return await _send_payment_link_for_user(request, user_id)


async def scenario_create_invoice_callback(payload: dict):
    user_id = str(payload.pop("user_id", "") or "")
    if not user_id:
        raise HTTPException(status_code=400, detail="User ID is required for scenario payments.")
    request = InvoiceCreateRequest(**payload)
    return await _create_invoice_for_user(request, user_id)


async def scenario_send_invoice_callback(payload: dict):
    user_id = str(payload.pop("user_id", "") or "")
    if not user_id:
        raise HTTPException(status_code=400, detail="User ID is required for scenario payments.")
    request = InvoiceSendRequest(**payload)
    return await _send_invoice_for_user(request, user_id)


async def scenario_refund_payment_callback(payload: dict):
    user_id = str(payload.pop("user_id", "") or "")
    if not user_id:
        raise HTTPException(status_code=400, detail="User ID is required for scenario payments.")
    request = RefundPaymentRequest(**payload)
    return await _refund_payment_for_user(request, user_id)


async def scenario_cancel_subscription_callback(payload: dict):
    user_id = str(payload.pop("user_id", "") or "")
    if not user_id:
        raise HTTPException(status_code=400, detail="User ID is required for scenario payments.")
    request = CancelSubscriptionRequest(**payload)
    return await _cancel_subscription_for_user(request, user_id)


async def scenario_send_email_callback(payload: dict):
    user_id = str(payload.get("user_id") or "")
    if not user_id:
        raise HTTPException(status_code=400, detail="User ID is required for scenario email.")
    provider = payload.get("provider") or None
    result = _send_email_for_user(
        user_id,
        payload.get("to") or "",
        payload.get("subject") or "",
        payload.get("body") or "",
        provider=provider,
    )
    return {
        **result,
        "id": result.get("id"),
        "thread_id": result.get("thread_id") or result.get("threadId"),
        "label_ids": result.get("labelIds") or [],
    }


scenario_engine = ScenarioEngine(
    supabase=supabase,
    callbacks={
        "create_customer": scenario_create_customer_callback,
        "update_customer": scenario_update_customer_callback,
        "create_payment": scenario_create_payment_callback,
        "send_payment_link": scenario_send_payment_link_callback,
        "create_invoice": scenario_create_invoice_callback,
        "send_invoice": scenario_send_invoice_callback,
        "refund_payment": scenario_refund_payment_callback,
        "cancel_subscription": scenario_cancel_subscription_callback,
        "send_email": scenario_send_email_callback,
        "emit_scenario_trigger": emit_scenario_trigger,
        "emit_appointment_change_triggers": emit_appointment_change_triggers,
    },
    base_url=os.environ.get("SCENARIO_ENGINE_BASE_URL", "http://127.0.0.1:8000"),
    plan_access_checker=enforce_call_minutes,
    scenario_access_checker=require_scenario_feature_access,
)

@app.post("/api/sonar/update-payment", tags=["Sonar Payments"])
async def update_payment(request: PaymentUpdateRequest, current_user: dict = Depends(get_current_user)):
    user_id = business_owner_id(current_user)
    require_payment_access(user_id)
    ensure_no_unresolved_templates(request.payment_id, request.description, request.notes)
    payment_record = None
    if request.payment_id:
        existing = supabase.table("payments").select("*").eq("stripe_payment_intent_id", request.payment_id).eq("user_id", user_id).limit(1).execute()
        if existing.data:
            payment_record = existing.data[0]
        else:
            existing = supabase.table("payments").select("*").eq("id", request.payment_id).eq("user_id", user_id).limit(1).execute()
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
    updated_payment = update_payment_record(match_field, match_value, update_data, user_id=user_id) or payment_record

    if request.status in {"succeeded", "paid"}:
        emit_payment_trigger("payment_received", {
            "user_id": user_id,
            "payment": updated_payment,
            "payment_id": request.payment_id,
            "amount": updated_payment.get("amount"),
            "currency": updated_payment.get("currency"),
            "status": updated_payment.get("status"),
        })
    elif request.status in {"refunded", "partial_refund"}:
        emit_payment_trigger("refund_issued", {
            "user_id": user_id,
            "payment": updated_payment,
            "payment_id": request.payment_id,
            "amount": updated_payment.get("refunded_amount") or updated_payment.get("amount"),
            "currency": updated_payment.get("currency"),
            "status": updated_payment.get("status"),
        })
    elif request.status in {"failed", "error", "declined"}:
        emit_payment_trigger("payment_failed", {
            "user_id": user_id,
            "payment": updated_payment,
            "payment_id": request.payment_id,
            "error_message": updated_payment.get("error_message"),
            "status": updated_payment.get("status"),
        })

    return updated_payment

@app.post("/stripe-webhook", tags=["Billing"])
async def stripe_webhook(request: Request, stripe_signature: str = Header(None)):
    if not stripe_webhook_secret:
        logging.error('main.stripe_webhook.event_11531')
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Stripe webhook authentication is not configured.")
    raw_body = await request.body()
    logging.info('main.stripe_webhook.event_11626')
    try:
        event = stripe.Webhook.construct_event(payload=raw_body, sig_header=stripe_signature, secret=stripe_webhook_secret)
    except ValueError:
        logging.warning('main.stripe_webhook.event_11473')
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        logging.warning('main.stripe_webhook.event_11476')
        raise HTTPException(status_code=400, detail="Invalid signature")

    event_type = event["type"]
    connected_account_id = event.get("account")
    is_connected_account_event = bool(connected_account_id)
    logging.info('main.stripe_webhook.event_11643')

    if event_type == 'checkout.session.completed':
        session = event['data']['object']
        if session.get("mode") == "payment":
            payment_status = session.get("payment_status")
            payment_record = upsert_payment_from_stripe(
                session_id=session.get("id"),
                status="succeeded" if payment_status == "paid" else payment_status or "succeeded",
            )
            logging.info('main.stripe_webhook.event_11492')
            if is_connected_account_event and payment_status == "paid":
                metadata = session.get("metadata") or {}
                user_id = resolve_scenario_user_id_from_stripe_event(event, metadata)
                logging.info('main.stripe_webhook.event_11496')
                if user_id:
                    emit_payment_trigger("payment_received", {
                        "checkout_session": session,
                        "payment": payment_record,
                        "payment_id": (payment_record or {}).get("id"),
                        "stripe_session_id": session.get("id"),
                        "customer_id": session.get("customer"),
                        "amount": session.get("amount_total") or session.get("amount_subtotal"),
                        "currency": session.get("currency"),
                        "status": payment_status,
                        "user_id": user_id,
                        "person_id": metadata.get("person_id"),
                    })
            return {"status": "success"}

        if is_connected_account_event:
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

        logging.info('main.stripe_webhook.event_11620')

        # Determine subscription status based on trial presence
        subscription_status = subscription.get('status')
        # If there's a trial_start, it means the subscription is currently in trial
        if subscription.get('trial_start'):
            subscription_status = "trialing"

        # Fetch current user data to check existing plan
        user_data_response = supabase.table('users').select('id,plan').eq('stripe_customer_id', customer_id).single().execute()
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
        sync_business_plan_entitlement(
            user_data_response.data.get('id') if user_data_response.data else None,
            plan_name,
            datetime.fromtimestamp(subscription.get('current_period_start'), timezone.utc).isoformat() if subscription.get('current_period_start') else None,
            datetime.fromtimestamp(subscription.get('current_period_end'), timezone.utc).isoformat() if subscription.get('current_period_end') else None,
            reset_usage=current_plan != plan_name,
        )
        logging.info('main.stripe_webhook.event_11655')

    elif event_type == 'invoice.upcoming':
        invoice = event['data']['object']
        if not is_connected_account_event:
            attach_overage_to_upcoming_invoice(invoice)
        return {"status": "success"}
    elif event_type in {'invoice.created', 'invoice.sent'}:
        # These invoice lifecycle events are intentionally not exposed as
        # Scenarios triggers.
        return {"status": "success"}
    elif event_type == 'invoice.paid':
        invoice = event['data']['object']
        if not is_connected_account_event:
            reconcile_overage_invoice(invoice.get("id"), "paid")
        if is_connected_account_event:
            return {"status": "success"}
        try:
            customer_id = invoice.get('customer')
            amount_paid = invoice.get('amount_paid') # amount_paid is in cents
            
            if not customer_id or amount_paid is None or amount_paid <= 0:
                logging.warning('main.stripe_webhook.event_11596')
                return {"status": "skipped"}
            
            # 1. Update user's subscription_status to "active" and increment months_subscribed
            user_data_response = supabase.table('users').select('id, plan, associate, months_subscribed, subscription_status, stripe_subscription_id').eq('stripe_customer_id', customer_id).single().execute()

            if user_data_response.data:
                user_id = user_data_response.data['id']
                associate_rep_id = user_data_response.data.get('associate')
                current_months_subscribed = user_data_response.data.get('months_subscribed', 0)
                current_subscription_status = user_data_response.data.get('subscription_status')
                # Get the subscription_id from your Supabase record, not the webhook payload
                subscription_id_from_db = user_data_response.data.get('stripe_subscription_id')

                # Validate that the subscription ID from the DB exists before proceeding
                if not subscription_id_from_db:
                    logging.error('main.stripe_webhook.event_11612')
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
                    logging.error('main.stripe_webhook.event_11627')
                    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update user's subscription status.")
                sync_business_plan_entitlement(
                    user_id,
                    user_data_response.data.get('plan'),
                    datetime.fromtimestamp(invoice.get('period_start'), timezone.utc).isoformat() if invoice.get('period_start') else None,
                    datetime.fromtimestamp(invoice.get('period_end'), timezone.utc).isoformat() if invoice.get('period_end') else None,
                    reset_usage=True,
                )
                logging.info('main.stripe_webhook.event_11636')
                # 2. Commission Calculation for Rep
                if associate_rep_id:
                    logging.info('main.stripe_webhook.event_11639')
                    rep_data_response = supabase.table('reps').select('id, tier, points').eq('associate_full_name', associate_rep_id).single().execute()
                    logging.debug('main.stripe_webhook.event_11641')
                    
                    if rep_data_response.data:
                        rep_db_id = rep_data_response.data['id']
                        rep_tier_name = rep_data_response.data.get('tier')
                        rep_current_points = rep_data_response.data.get('points') or 0 # Ensure points default to 0 if None

                        if rep_tier_name:
                            tier_data_response = supabase.table('tiers').select('multiplier_new_acquisition, multiplier_rebill').eq('name', rep_tier_name).single().execute() # type: ignore
                            logging.debug('main.stripe_webhook.event_11650')
                            if tier_data_response.data:
                                multiplier = 0
                                # Use the previous status to determine the multiplier
                                if current_subscription_status == 'trialing':
                                    multiplier = tier_data_response.data.get('multiplier_new_acquisition', 0)
                                    logging.info('main.stripe_webhook.event_11656')
                                else:
                                    multiplier = tier_data_response.data.get('multiplier_rebill', 0)
                                    logging.info('main.stripe_webhook.event_11659')

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
                                    logging.error('main.stripe_webhook.event_11683')
                                    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update user's awarded points.")
                                logging.info('main.stripe_webhook.event_11685')
                                logging.info('main.stripe_webhook.event_11686')


                                rep_points_update_response = supabase.table('reps').update({'points': updated_points}).eq('id', rep_db_id).execute() # type: ignore
                                if not rep_points_update_response.data:
                                    logging.error('main.stripe_webhook.event_11691')
                                    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update rep's points.")
                                logging.info('main.stripe_webhook.event_11693')
                            else:
                                logging.warning('main.stripe_webhook.event_11695')
                        else:
                            logging.warning('main.stripe_webhook.event_11697')
                    else:
                        logging.warning('main.stripe_webhook.event_11699')
                else:
                    logging.warning('main.stripe_webhook.event_11701')
            else:
                logging.warning('main.stripe_webhook.event_11703')
        except HTTPException:
            raise # Re-raise HTTPExceptions
        except Exception as e:
            logging.error('main.stripe_webhook.event_11707')
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='The request could not be completed')

    elif event_type == 'invoice.payment_failed':
        invoice = event['data']['object']
        if not is_connected_account_event:
            reconcile_overage_invoice(invoice.get("id"), "failed")
        if is_connected_account_event:
            metadata = invoice.get("metadata") or {}
            user_id = resolve_scenario_user_id_from_stripe_event(event, metadata)
            if user_id:
                trigger_key = "payment_failed"
                emit_payment_trigger(trigger_key, {
                    "invoice": invoice,
                    "customer_id": invoice.get("customer"),
                    "invoice_id": invoice.get("id"),
                    "subscription_id": invoice.get("subscription"),
                    "failure_reason": invoice.get("last_payment_error", {}).get("message"),
                    "currency": invoice.get("currency"),
                    "status": invoice.get("status"),
                    "user_id": user_id,
                    "person_id": metadata.get("person_id"),
                })
            return {"status": "success"}
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
                logging.error('main.stripe_webhook.event_11758')
        else:
            logging.error('main.stripe_webhook.event_11760')
    elif event_type == 'invoice.voided':
        invoice = event['data']['object']
        if not is_connected_account_event:
            reconcile_overage_invoice(invoice.get("id"), "void")
        return {"status": "success"}
    elif event_type == 'payment_intent.succeeded':
        payment_intent = event['data']['object']
        updated_payment = upsert_payment_from_stripe(
            payment_intent_id=payment_intent.get("id"),
            status="succeeded",
            receipt_url=payment_intent.get("charges", {}).get("data", [{}])[0].get("receipt_url") if payment_intent.get("charges", {}).get("data") else None,
        )
        metadata = payment_intent.get("metadata") or {}
        user_id = resolve_scenario_user_id_from_stripe_event(event, metadata)
        logging.info('main.stripe_webhook.event_11775')
        if user_id:
            emit_payment_trigger("payment_received", {
                "payment_intent": payment_intent,
                "payment": updated_payment,
                "payment_id": (updated_payment or {}).get("id"),
                "customer_id": payment_intent.get("customer"),
                "amount": payment_intent.get("amount_received") or payment_intent.get("amount"),
                "currency": payment_intent.get("currency"),
                "status": payment_intent.get("status"),
                "user_id": user_id,
                "person_id": metadata.get("person_id"),
            })
    elif event_type == 'payment_intent.payment_failed':
        payment_intent = event['data']['object']
        last_error = payment_intent.get("last_payment_error", {})
        updated_payment = upsert_payment_from_stripe(
            payment_intent_id=payment_intent.get("id"),
            status="failed",
            error_message=last_error.get("message"),
        )
        metadata = payment_intent.get("metadata") or {}
        user_id = resolve_scenario_user_id_from_stripe_event(event, metadata)
        if user_id:
            emit_payment_trigger("payment_failed", {
                "payment_intent": payment_intent,
                "payment": updated_payment,
                "payment_id": (updated_payment or {}).get("id"),
                "customer_id": payment_intent.get("customer"),
                "failure_reason": last_error.get("message"),
                "amount": payment_intent.get("amount"),
                "currency": payment_intent.get("currency"),
                "status": payment_intent.get("status"),
                "user_id": user_id,
                "person_id": metadata.get("person_id"),
            })
    elif event_type == 'refund.created':
        refund = event['data']['object']
        metadata = refund.get("metadata") or {}
        user_id = resolve_scenario_user_id_from_stripe_event(event, metadata)
        payment_intent_id = refund.get("payment_intent")
        customer_id = refund.get("customer")
        payment_record = None
        if payment_intent_id:
            payment_record = update_payment_record(
                "stripe_payment_intent_id",
                payment_intent_id,
                {
                    "status": "refunded",
                    "refunded_amount": refund.get("amount"),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                },
            )
            if not customer_id and user_id:
                try:
                    customer_id = _stripe_object_to_dict(
                        stripe.PaymentIntent.retrieve(payment_intent_id, **_get_connected_stripe_request_options(user_id))
                    ).get("customer")
                except Exception:
                    customer_id = None
        if user_id:
            emit_payment_trigger("refund_issued", {
                "refund": refund,
                "payment": payment_record,
                "refund_id": refund.get("id"),
                "payment_id": (payment_record or {}).get("id"),
                "customer_id": customer_id,
                "amount": refund.get("amount"),
                "currency": refund.get("currency"),
                "status": refund.get("status"),
                "user_id": user_id,
                "person_id": metadata.get("person_id"),
            })
    elif event_type == 'customer.created':
        return {"status": "success"}
    elif event_type == 'customer.subscription.updated':
        subscription = event['data']['object']
        if is_connected_account_event:
            return {"status": "success"}
        customer_id = subscription.get("customer")
        if customer_id:
            user_response = (
                supabase_admin.table("users")
                .select("id,plan")
                .eq("stripe_customer_id", customer_id)
                .limit(1)
                .execute()
            )
            user_row = (user_response.data or [None])[0]
            if user_row:
                status_value = str(subscription.get("status") or "").lower()
                if subscription.get("trial_start"):
                    status_value = "trialing"
                update_data = {
                    "stripe_subscription_id": subscription.get("id"),
                    "subscription_status": status_value,
                    "trial_start_date": date.fromtimestamp(subscription.get("trial_start")).isoformat() if subscription.get("trial_start") else None,
                    "trial_end_date": date.fromtimestamp(subscription.get("trial_end")).isoformat() if subscription.get("trial_end") else None,
                }
                price_data = (((subscription.get("items") or {}).get("data") or [{}])[0]).get("price") or {}
                product_id = price_data.get("product")
                if product_id:
                    product = stripe.Product.retrieve(product_id)
                    plan_name = str(product.get("name") or "").strip().lower()
                    if plan_name in DEFAULT_PLAN_ENTITLEMENTS:
                        update_data["plan"] = plan_name
                supabase_admin.table("users").update(update_data).eq("id", user_row["id"]).execute()
                sync_business_plan_entitlement(
                    user_row["id"],
                    update_data.get("plan") or user_row.get("plan") or "free",
                    datetime.fromtimestamp(subscription.get("current_period_start"), timezone.utc).isoformat() if subscription.get("current_period_start") else None,
                    datetime.fromtimestamp(subscription.get("current_period_end"), timezone.utc).isoformat() if subscription.get("current_period_end") else None,
                )
        return {"status": "success"}
    elif event_type == 'customer.subscription.created':
        subscription = event['data']['object']
        if is_connected_account_event:
            metadata = subscription.get("metadata") or {}
            user_id = resolve_scenario_user_id_from_stripe_event(event, metadata)
            if user_id:
                emit_payment_trigger("subscription_created", {
                    "subscription": subscription,
                    "subscription_id": subscription.get("id"),
                    "customer_id": subscription.get("customer"),
                    "status": subscription.get("status"),
                    "user_id": user_id,
                    "person_id": metadata.get("person_id"),
                })
    elif event_type == 'customer.subscription.deleted':
        subscription = event['data']['object']
        if is_connected_account_event:
            return {"status": "success"}
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
                sync_business_plan_entitlement(user_id, "free", reset_usage=True)
                logging.info('main.stripe_webhook.event_11936')
            else:
                logging.warning('main.stripe_webhook.event_11938')
        else:
            logging.error('main.stripe_webhook.event_11940')
    return {"status": "success"}








# --- User Endpoints ---


@app.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED, tags=["Users"])
async def create_user(auth_data: AuthSignUpRequest, request: Request):
    try:
        if not auth_data.terms_accepted or auth_data.legal_version != NODEMERE_LEGAL_ACCEPTANCE_VERSION:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current Nodemere legal terms must be accepted to create an account.",
            )
        auth_response = new_auth_client().auth.sign_up({"email": auth_data.email, "password": auth_data.password})
        if not auth_response.user:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Supabase signup failed")
        
        user_id = auth_response.user.id
        user_metadata = getattr(auth_response.user, "user_metadata", {}) or {}
        profile_data = {
            "id": str(user_id),
            "email": auth_data.email,
            "full_name": user_metadata.get("full_name") or user_metadata.get("name"),
            "phone": user_metadata.get("phone"),
            "onboarded": False,
            "terms_of_service": {
                NODEMERE_LEGAL_ACCEPTANCE_KEY: {
                    "accepted": True,
                    "version": NODEMERE_LEGAL_ACCEPTANCE_VERSION,
                    "accepted_at": datetime.now(timezone.utc).isoformat(),
                    "source": "signup",
                    "ip_address": get_client_ip(request),
                    "certified_permitted_use": auth_data.certified_permitted_use,
                }
            },
        }
        db_response = supabase_admin.table('users').insert(profile_data).execute()
        
        if not db_response.data:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create user profile")
        return db_response.data[0]
    except HTTPException:
        raise
    except AuthApiError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='The request could not be completed')
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='The request could not be completed')

@app.get("/users/me", tags=["Users"])
async def read_current_user(current_user: dict = Depends(get_current_user)):
    logging.info('main.read_current_user.event_12187')
    try:
        response = supabase_admin.table('users').select('*').eq('id', str(current_user.id)).limit(1).execute()
        logging.info('main.read_current_user.event_12089')
        
        if not response.data or not response.data[0]:
            logging.info('main.read_current_user.event_12027')
            
            user_email = current_user.email
            user_metadata = getattr(current_user, "user_metadata", {}) or {}
            logging.info('main.read_current_user.event_12031')

            profile_data = {
                "id": str(current_user.id),
                "email": user_email,
                "full_name": user_metadata.get("full_name") or user_metadata.get("name"),
                "phone": user_metadata.get("phone"),
                "onboarded": False,
            }
            logging.info('main.read_current_user.event_12040')
            
            insert_response = supabase_admin.table('users').insert(profile_data).execute()
            logging.info('main.read_current_user.event_12043')

            if not insert_response.data:
                logging.error('main.read_current_user.event_12040')
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create user profile after OAuth login.")
            
            # Return the newly created profile
            return UserResponse.model_validate(insert_response.data[0]).model_dump()
        
        return UserResponse.model_validate(response.data[0]).model_dump()
    except Exception as e:
        logging.error('main.read_current_user.event_12054')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='The request could not be completed')


@app.get("/users/me/privacy-requests", tags=["Users"])
async def list_privacy_requests(current_user: dict = Depends(get_current_user)):
    response = (
        supabase_admin.table("account_data_requests")
        .select("id,request_type,status,details,created_at,completed_at")
        .eq("user_id", str(current_user.id))
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    )
    return response.data or []


@app.post("/users/me/privacy-requests", tags=["Users"])
async def create_privacy_request(payload: dict, current_user: dict = Depends(get_current_user)):
    request_type = str((payload or {}).get("request_type") or "").strip().lower()
    if request_type not in {"access", "deletion", "correction"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="request_type must be access, deletion, or correction")
    if request_type == "deletion":
        from .authorization import authorize_account_closure
        authorize_account_closure(getattr(supabase_admin,'raw',supabase_admin), str(current_user.id), getattr(current_user,'nodemere_aal','aal1'))
    elif request_type == "access" and getattr(current_user,'nodemere_aal','aal1') != 'aal2':
        raise HTTPException(403,'Verify your authenticator before requesting an export')
    details = str((payload or {}).get("details") or "").strip()[:2000] or None
    existing = (
        supabase_admin.table("account_data_requests")
        .select("id,request_type,status,created_at")
        .eq("user_id", str(current_user.id))
        .eq("request_type", request_type)
        .in_("status", ["requested", "processing"])
        .limit(1)
        .execute()
    ).data or []
    if existing:
        return existing[0]
    response = supabase_admin.table("account_data_requests").insert({
        "user_id": str(current_user.id),
        "request_type": request_type,
        "details": details,
    }).execute()
    if not response.data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Privacy request could not be created")
    if request_type == "deletion":
        supabase_admin.table("users").update({
            "account_status": "pending_deletion",
            "deletion_requested_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", str(current_user.id)).execute()
    return response.data[0]


@app.post("/users/me/account/close", tags=["Users"])
async def close_account(current_user: dict = Depends(get_current_user)):
    from .authorization import authorize_account_closure
    authorize_account_closure(getattr(supabase_admin,'raw',supabase_admin), str(current_user.id), getattr(current_user,'nodemere_aal','aal1'))
    user_id = str(current_user.id)
    profile_response = (
        supabase_admin.table("users")
        .select("subscription_status,stripe_customer_id")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    profile = (profile_response.data or [None])[0]
    status_value = str((profile or {}).get("subscription_status") or "").lower()
    usage_snapshot = None
    try:
        usage_snapshot = get_usage_snapshot(user_id)
    except Exception:
        logging.warning('main.request_account_deletion.usage_snapshot_failed.event_12389')
    subscription_canceled = False
    if status_value in {"active", "trialing", "past_due", "unpaid", "failed"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "subscription_must_be_canceled",
                "message": "Cancel your subscription in Stripe Billing Portal before closing this account.",
            },
        )

    now = datetime.now(timezone.utc).isoformat()
    supabase_admin.table("account_data_requests").insert({
        "user_id": user_id,
        "request_type": "deletion",
        "details": "Account closure requested from Account Settings.",
    }).execute()
    update_response = supabase_admin.table("users").update({
        "account_status": "closed",
        "closed_at": now,
        "deletion_requested_at": now,
    }).eq("id", user_id).execute()
    if not update_response.data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Account could not be closed")
    return {
        "closed": True,
        "message": "Your account is closed and your deletion request has been submitted.",
    }


@app.post("/users/me/account/delete", tags=["Users"])
async def request_account_deletion(payload: AccountDeletionRequest, current_user: dict = Depends(get_current_user)):
    """Submit the user-facing SaaS account deletion request.

    Access is disabled immediately by marking the profile pending_deletion. A
    separate retention/deletion worker can process the queued request without
    making the browser responsible for deleting tenant data piecemeal.
    """
    from .authorization import authorize_account_closure

    if not payload.acknowledged:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please acknowledge the account deletion terms")

    allowed_reasons = {
        "I no longer need Nodemere",
        "It is too expensive",
        "I could not get it set up",
        "It is missing something I need",
        "I am switching to another product",
        "Other",
    }
    if payload.reason not in allowed_reasons:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Select a valid deletion reason")

    user_id = str(current_user.id)
    authorize_account_closure(
        getattr(supabase_admin, 'raw', supabase_admin),
        user_id,
        getattr(current_user, 'nodemere_aal', 'aal1'),
    )

    profile_response = (
        supabase_admin.table("users")
        .select("subscription_status,account_status")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    profile = (profile_response.data or [None])[0]
    status_value = str((profile or {}).get("subscription_status") or "").lower()
    if status_value in {"active", "trialing", "past_due", "unpaid", "failed"}:
        try:
            await _cancel_subscription_for_user(CancelSubscriptionRequest(), user_id)
        except HTTPException as exc:
            logging.warning('main.request_account_deletion.billing_cancel_failed.event_12390')
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="We could not cancel your subscription, so your account was not scheduled for deletion. Please retry.",
            ) from exc
        except Exception as exc:
            logging.warning('main.request_account_deletion.billing_cancel_failed.event_12391')
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="We could not cancel your subscription, so your account was not scheduled for deletion. Please retry.",
            ) from exc
        supabase_admin.table("users").update({
            "plan": "free",
            "subscription_status": "canceled",
            "billing_period": None,
        }).eq("id", user_id).execute()
        subscription_canceled = True
    if str((profile or {}).get("account_status") or "").lower() in {"pending_deletion", "closed"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A deletion request is already pending for this account")

    business_response = (
        supabase_admin.table("businesses")
        .select("name")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    business = (business_response.data or [None])[0]
    expected_name = re.sub(r"\s+", " ", str((business or {}).get("name") or "").strip()).casefold()
    supplied_name = re.sub(r"\s+", " ", payload.business_name.strip()).casefold()
    if not expected_name or supplied_name != expected_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Type your business name exactly to confirm deletion")

    pending_request = (
        supabase_admin.table("account_data_requests")
        .select("id,request_type,status,created_at")
        .eq("user_id", user_id)
        .eq("request_type", "deletion")
        .in_("status", ["requested", "processing"])
        .limit(1)
        .execute()
    ).data or []
    if pending_request:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A deletion request is already pending for this account")

    now = datetime.now(timezone.utc).isoformat()
    request_response = supabase_admin.table("account_data_requests").insert({
        "user_id": user_id,
        "request_type": "deletion",
        "details": json.dumps({
            "source": "Settings > Account",
            "reason": payload.reason,
            "feedback": payload.feedback.strip() if payload.feedback else None,
            "business_name_confirmed": True,
            "billing_action": "canceled_immediately" if subscription_canceled else "no_active_subscription",
            "usage_snapshot": {
                "used_seconds": usage_snapshot.get("used_seconds", 0) if usage_snapshot else 0,
                "included_seconds": usage_snapshot.get("included_seconds", 0) if usage_snapshot else 0,
                "overage_seconds": usage_snapshot.get("overage_seconds", 0) if usage_snapshot else 0,
                "billable_overage_minutes": usage_snapshot.get("billable_overage_minutes", 0) if usage_snapshot else 0,
                "estimated_overage_amount_cents": usage_snapshot.get("estimated_overage_amount_cents", 0) if usage_snapshot else 0,
            },
            "requested_at": now,
        }),
    }).execute()
    if not request_response.data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Deletion request could not be created")

    update_response = supabase_admin.table("users").update({
        "account_status": "pending_deletion",
        "deletion_requested_at": now,
    }).eq("id", user_id).execute()
    if not update_response.data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Account could not be scheduled for deletion")

    return {
        "requested": True,
        "request_id": request_response.data[0].get("id"),
        "access_ends_at": now,
        "retention_period_days": 30,
        "minutes_policy": "Used minutes and accrued overage remain attached to the canceled billing cycle. Unused included minutes do not carry over; a new plan starts a fresh allowance.",
        "message": "Your subscription was canceled, your account has been scheduled for deletion, and your access has ended.",
    }


@app.post("/users/me/account/reactivate", tags=["Users"])
async def reactivate_account(current_user: dict = Depends(get_current_user_for_recovery)):
    """Withdraw a pending deletion during the account's recovery window."""
    from .authorization import authorize_account_closure

    user_id = str(current_user.id)
    profile_response = (
        supabase_admin.table("users")
        .select("account_status,deletion_requested_at")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    profile = (profile_response.data or [None])[0] or {}
    account_status = str(profile.get("account_status") or "").lower()
    if account_status == "active":
        return {"reactivated": False, "message": "Your account is already active."}
    if account_status != "pending_deletion":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This account cannot be restored.")

    requested_at = profile.get("deletion_requested_at")
    if requested_at:
        try:
            recovery_deadline = datetime.fromisoformat(str(requested_at).replace("Z", "+00:00")) + timedelta(days=30)
            if datetime.now(timezone.utc) >= recovery_deadline:
                raise HTTPException(status_code=status.HTTP_410_GONE, detail="The account recovery window has expired.")
        except HTTPException:
            raise
        except (TypeError, ValueError):
            recovery_deadline = None
    else:
        recovery_deadline = None

    authorize_account_closure(
        getattr(supabase_admin, 'raw', supabase_admin),
        user_id,
        getattr(current_user, 'nodemere_aal', 'aal1'),
    )

    now = datetime.now(timezone.utc).isoformat()
    pending_requests = (
        supabase_admin.table("account_data_requests")
        .select("id,details")
        .eq("user_id", user_id)
        .eq("request_type", "deletion")
        .in_("status", ["requested", "processing"])
        .execute()
    ).data or []
    for request_row in pending_requests:
        raw_details = request_row.get("details")
        try:
            details = json.loads(raw_details) if isinstance(raw_details, str) else dict(raw_details or {})
        except (TypeError, ValueError):
            details = {"original_details": raw_details}
        details.update({"withdrawn_at": now, "outcome": "withdrawn_during_recovery"})
        supabase_admin.table("account_data_requests").update({
            "status": "rejected",
            "completed_at": now,
            "details": json.dumps(details),
        }).eq("id", request_row["id"]).execute()

    update_response = supabase_admin.table("users").update({
        "account_status": "active",
        "deletion_requested_at": None,
        "closed_at": None,
    }).eq("id", user_id).execute()
    if not update_response.data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Account could not be restored")

    return {
        "reactivated": True,
        "subscription_status": "canceled",
        "recovery_deadline": recovery_deadline.isoformat() if recovery_deadline else None,
        "message": "Your account has been restored. Choose a plan to restart your subscription.",
    }


@app.post("/users/me/legal-acceptance", tags=["Users"])
async def accept_legal_terms(
    acceptance: LegalAcceptanceRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    if (
        acceptance.version != NODEMERE_LEGAL_ACCEPTANCE_VERSION
        or acceptance.accepted_terms is not True
        or acceptance.certified_permitted_use is not True
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The current legal terms and permitted-use certification are required.",
        )

    current_user_id = str(current_user.id)
    try:
        profile_response = (
            supabase_admin.table("users")
            .select("terms_of_service")
            .eq("id", current_user_id)
            .limit(1)
            .execute()
        )
        profile = (profile_response.data or [{}])[0]
        terms = profile.get("terms_of_service") or {}
        if not isinstance(terms, dict):
            terms = {}
        terms[NODEMERE_LEGAL_ACCEPTANCE_KEY] = {
            "accepted": True,
            "version": NODEMERE_LEGAL_ACCEPTANCE_VERSION,
            "accepted_at": datetime.now(timezone.utc).isoformat(),
            "source": "legal_acceptance_gate",
            "ip_address": get_client_ip(request),
            "certified_permitted_use": True,
        }
        if profile_response.data:
            response = (
                supabase_admin.table("users")
                .update({"terms_of_service": terms})
                .eq("id", current_user_id)
                .execute()
            )
        else:
            # OAuth may return here before the ordinary profile read has created
            # a row.  Create that row with the acceptance rather than treating a
            # zero-row update as a successful legal record.
            user_metadata = getattr(current_user, "user_metadata", {}) or {}
            response = supabase_admin.table("users").upsert({
                "id": current_user_id,
                "email": current_user.email,
                "full_name": user_metadata.get("full_name") or user_metadata.get("name"),
                "phone": user_metadata.get("phone"),
                "onboarded": False,
                "terms_of_service": terms,
            }).execute()
        if not response.data:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to record legal acceptance.")
        return {"ok": True, "terms_of_service": response.data[0].get("terms_of_service") if response.data else terms}
    except HTTPException:
        raise
    except Exception as exc:
        logging.error('main.accept_legal_terms.event_12190')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to record legal acceptance.") from exc

@app.get("/users/me/integrations", response_model=List[UserIntegrationResponse], tags=["Users"])
async def list_user_integrations(current_user: dict = Depends(get_current_user)):
    current_user_id = business_owner_id(current_user)
    try:
        rows = (
            supabase_admin.table("integrations")
            .select("*")
            .eq("user_id", current_user_id)
            .execute()
            .data
            or []
        )
        by_provider = {row.get("provider"): row for row in rows if row.get("provider")}
        if is_payment_test_mode():
            simulated_stripe = _default_user_integration("stripe", current_user_id)
            simulated_stripe.update({
                "status": "connected",
                "selected": True,
                "provider_metadata": {
                    "display_name": "Simulated Stripe",
                    "test_mode": True,
                    "livemode": False,
                },
            })
            by_provider["stripe"] = simulated_stripe
        integrations = [
            UserIntegrationResponse.model_validate(
                _serialize_public_integration(
                    by_provider.get(provider) or _default_user_integration(provider, current_user_id),
                    current_user_id,
                )
            )
            for provider in sorted(SUPPORTED_INTEGRATION_PROVIDERS)
        ]
        return [integration.model_dump() for integration in integrations]
    except Exception as e:
        logging.error('main.list_user_integrations.event_12229')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to load integrations.")

@app.put("/users/me/integrations/{provider}", response_model=UserIntegrationResponse, tags=["Users"])
async def upsert_user_integration(
    provider: str,
    payload: UserIntegrationUpdate,
    current_user: dict = Depends(get_current_user),
):
    provider = provider.lower().strip()
    if provider not in SUPPORTED_INTEGRATION_PROVIDERS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Integration provider not supported.")

    current_user_id = business_owner_id(current_user)
    if provider == "stripe":
        require_payment_access(current_user_id)
    # Connection identity, scopes, status and metadata are written only by the
    # server-side authorize/callback/disconnect flows. The UI may select providers.
    update_data = payload.model_dump(exclude_unset=True, include={"selected"})

    try:
        saved = _upsert_integration_row(current_user_id, provider, update_data)
        return UserIntegrationResponse.model_validate(
            _serialize_public_integration(saved, current_user_id)
        ).model_dump()
    except HTTPException:
        raise
    except Exception as e:
        logging.error('main.upsert_user_integration.event_12257')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to save integration.")

@app.get("/users/me/integrations/{provider}/authorize", response_model=IntegrationAuthorizeResponse, tags=["Users"])
async def authorize_user_integration(
    provider: str,
    request: Request,
    return_to: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    provider = provider.lower().strip()
    if provider not in SUPPORTED_INTEGRATION_PROVIDERS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Integration provider not supported.")

    if provider == "stripe":
        require_payment_access(business_owner_id(current_user))

    if provider == "gmail":
        if not google_client_id or not google_client_secret:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Google OAuth is not configured.")

        redirect_uri = _get_google_redirect_uri(request)
        state_token = _build_integration_state(business_owner_id(current_user), provider, return_to)
        params = {
            "client_id": google_client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": " ".join(GMAIL_SCOPES),
            "access_type": "offline",
            "prompt": "consent",
            "include_granted_scopes": "true",
            "state": state_token,
        }
        authorization_url = requests.Request("GET", GMAIL_AUTH_URL, params=params).prepare().url
    elif provider == "outlook":
        if not outlook_client_id or not outlook_client_secret:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Outlook OAuth is not configured.")

        redirect_uri = _get_outlook_redirect_uri(request)
        state_token = _build_integration_state(business_owner_id(current_user), provider, return_to)
        params = {
            "client_id": outlook_client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "response_mode": "query",
            "scope": outlook_scopes,
            "prompt": "consent",
            "state": state_token,
        }
        authorization_url = requests.Request("GET", OUTLOOK_AUTH_URL, params=params).prepare().url
    elif provider == "stripe":
        if is_payment_test_mode():
            _upsert_integration_row(
                business_owner_id(current_user),
                provider,
                {
                    "selected": True,
                    "status": "connected",
                    "provider_metadata": {
                        "display_name": "Simulated Stripe",
                        "test_mode": True,
                        "livemode": False,
                    },
                    "credentials": {},
                },
            )
            authorization_url = f"{get_payment_frontend_base_url().rstrip('/')}/dashboard?integration=stripe&simulated=true"
        else:
            if not _stripe_connect_client_id():
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Stripe Connect is not configured.")
            _stripe_platform_api_key()

            redirect_uri = _get_stripe_redirect_uri(request)
            state_token = _build_integration_state(business_owner_id(current_user), provider, return_to)
            params = {
                "client_id": _stripe_connect_client_id(),
                "redirect_uri": redirect_uri,
                "response_type": "code",
                "scope": STRIPE_CONNECT_SCOPE,
                "state": state_token,
            }
            authorization_url = requests.Request("GET", STRIPE_CONNECT_AUTH_URL, params=params).prepare().url
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Provider authorization not implemented.")
    if not authorization_url:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create authorization URL.")
    if not (provider == "stripe" and is_payment_test_mode()):
        _upsert_integration_row(
            business_owner_id(current_user),
            provider,
            {
                "selected": True,
                "status": "selected",
                "provider_metadata": {
                    "last_authorize_started_at": datetime.now(timezone.utc).isoformat(),
                },
            },
        )
    return {"provider": provider, "authorization_url": authorization_url}


@app.get("/users/me/integrations/gmail/callback", response_class=HTMLResponse, name="gmail_integration_callback", tags=["Users"])
async def gmail_integration_callback(
    request: Request,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
):
    frontend_target = frontend_base_url or "/"
    success = False
    message = "Gmail could not be connected."

    try:
        if error:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='The request could not be completed')
        if not code or not state:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing OAuth callback parameters.")

        state_payload = _decode_integration_state(state, "gmail")
        user_id = str(state_payload["sub"])
        frontend_target = state_payload.get("return_to") or frontend_target
        redirect_uri = _get_google_redirect_uri(request)
        token_data = _exchange_google_code(code, redirect_uri)

        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        expires_in = int(token_data.get("expires_in") or 3600)
        scope_string = token_data.get("scope") or ""
        scopes = [scope for scope in scope_string.split(" ") if scope]

        userinfo_response = requests.get(
            GMAIL_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=30,
        )
        if not userinfo_response.ok:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to fetch Google account details.")
        userinfo = userinfo_response.json()
        connected_email = userinfo.get("email")

        existing_row = _fetch_integration_row(user_id, "gmail") or _default_user_integration("gmail", user_id)
        existing_credentials = existing_row.get("credentials") or {}
        credentials = {
            **existing_credentials,
            "access_token": access_token,
            "refresh_token": refresh_token or existing_credentials.get("refresh_token"),
            "token_type": token_data.get("token_type", "Bearer"),
            "expires_at": (datetime.now(timezone.utc) + timedelta(seconds=expires_in - 60)).isoformat(),
        }

        _upsert_integration_row(
            user_id,
            "gmail",
            {
                "selected": True,
                "status": "connected",
                "connected_email": connected_email,
                "scopes": scopes,
                "provider_metadata": {
                    "display_name": userinfo.get("name"),
                    "picture": userinfo.get("picture"),
                    "connected_at": datetime.now(timezone.utc).isoformat(),
                    "supports_send": True,
                    "supports_read": True,
                },
                "credentials": credentials,
            },
        )
        success = True
        message = "Gmail connected."
    except HTTPException as exc:
        message = exc.detail
    except Exception as exc:
        logging.error('main.gmail_integration_callback.event_12430')
        message = "Gmail could not be connected."

    callback_payload = script_safe_json({
        "type": "sonar.integration.oauth_complete",
        "provider": "gmail",
        "success": success,
        "message": message,
    })
    safe_target = script_safe_json(frontend_target)
    html = f"""
    <!doctype html>
    <html>
      <body style="font-family: Inter, sans-serif; background:#09090b; color:#fff; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0;">
        <div style="text-align:center;">
          <div style="font-size:18px; font-weight:600; margin-bottom:8px;">{escape_html(str(message))}</div>
          <div style="font-size:13px; color:rgba(255,255,255,0.6);">You can close this window.</div>
        </div>
        <script>
          (function() {{
            const payload = {callback_payload};
            const targetOrigin = (function() {{
              try {{
                return new URL({safe_target}, window.location.origin).origin;
              }} catch (e) {{
                return window.location.origin;
              }}
            }})();
            if (window.opener && !window.opener.closed) {{
              window.opener.postMessage(payload, targetOrigin);
              setTimeout(function() {{ window.close(); }}, 350);
            }} else {{
              setTimeout(function() {{ window.location.replace({safe_target}); }}, 350);
            }}
          }})();
        </script>
      </body>
    </html>
    """
    return HTMLResponse(content=html)


@app.get("/users/me/integrations/outlook/callback", response_class=HTMLResponse, name="outlook_integration_callback", tags=["Users"])
async def outlook_integration_callback(
    request: Request,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
):
    frontend_target = frontend_base_url or "/"
    success = False
    message = "Outlook could not be connected."

    try:
        if error:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='The request could not be completed')
        if not code or not state:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing OAuth callback parameters.")

        state_payload = _decode_integration_state(state, "outlook")
        user_id = str(state_payload["sub"])
        frontend_target = state_payload.get("return_to") or frontend_target
        redirect_uri = _get_outlook_redirect_uri(request)
        token_data = _exchange_outlook_code(code, redirect_uri)

        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        expires_in = int(token_data.get("expires_in") or 3600)
        scope_string = token_data.get("scope") or ""
        scopes = [scope for scope in scope_string.split(" ") if scope]

        userinfo_response = requests.get(
            GRAPH_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=30,
        )
        if not userinfo_response.ok:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to fetch Microsoft account details.")
        userinfo = userinfo_response.json()
        connected_email = userinfo.get("mail") or userinfo.get("userPrincipalName") or userinfo.get("email")

        existing_row = _fetch_integration_row(user_id, "outlook") or _default_user_integration("outlook", user_id)
        existing_credentials = existing_row.get("credentials") or {}
        credentials = {
            **existing_credentials,
            "access_token": access_token,
            "refresh_token": refresh_token or existing_credentials.get("refresh_token"),
            "token_type": token_data.get("token_type", "Bearer"),
            "expires_at": (datetime.now(timezone.utc) + timedelta(seconds=expires_in - 60)).isoformat(),
        }

        _upsert_integration_row(
            user_id,
            "outlook",
            {
                "selected": True,
                "status": "connected",
                "connected_email": connected_email,
                "scopes": scopes,
                "provider_metadata": {
                    "display_name": userinfo.get("displayName"),
                    "connected_at": datetime.now(timezone.utc).isoformat(),
                    "supports_send": True,
                    "supports_read": True,
                },
                "credentials": credentials,
            },
        )
        success = True
        message = "Outlook connected."
    except HTTPException as exc:
        message = exc.detail
    except Exception as exc:
        logging.error('main.outlook_integration_callback.event_12543')
        message = "Outlook could not be connected."

    callback_payload = script_safe_json({
        "type": "sonar.integration.oauth_complete",
        "provider": "outlook",
        "success": success,
        "message": message,
    })
    safe_target = script_safe_json(frontend_target)
    html = f"""
    <!doctype html>
    <html>
      <body style="font-family: Inter, sans-serif; background:#09090b; color:#fff; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0;">
        <div style="text-align:center;">
          <div style="font-size:18px; font-weight:600; margin-bottom:8px;">{escape_html(str(message))}</div>
          <div style="font-size:13px; color:rgba(255,255,255,0.6);">You can close this window.</div>
        </div>
        <script>
          (function() {{
            const payload = {callback_payload};
            const targetOrigin = (function() {{
              try {{
                return new URL({safe_target}, window.location.origin).origin;
              }} catch (e) {{
                return window.location.origin;
              }}
            }})();
            if (window.opener && !window.opener.closed) {{
              window.opener.postMessage(payload, targetOrigin);
            }}
            setTimeout(function() {{ window.close(); }}, 350);
          }})();
        </script>
      </body>
    </html>
    """
    return HTMLResponse(content=html)


@app.get("/users/me/integrations/stripe/callback", response_class=HTMLResponse, name="stripe_integration_callback", tags=["Users"])
async def stripe_integration_callback(
    request: Request,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    error_description: Optional[str] = None,
):
    frontend_target = frontend_base_url or "/"
    success = False
    message = "Stripe could not be connected."

    try:
        if error:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='The request could not be completed')
        if not code or not state:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing OAuth callback parameters.")

        state_payload = _decode_integration_state(state, "stripe")
        user_id = str(state_payload["sub"])
        frontend_target = state_payload.get("return_to") or frontend_target
        require_payment_access(user_id)
        token_data = _exchange_stripe_code(code)
        stripe_user_id = token_data.get("stripe_user_id")
        if not stripe_user_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Stripe did not return a connected account ID.")

        livemode = bool(token_data.get("livemode"))
        account = _stripe_object_to_dict(
            stripe.Account.retrieve(
                stripe_user_id,
                api_key=_stripe_platform_api_key(livemode),
            )
        )
        business_profile = account.get("business_profile") or {}
        settings = account.get("settings") or {}
        dashboard = settings.get("dashboard") or {}
        connected_email = account.get("email")
        display_name = business_profile.get("name") or dashboard.get("display_name") or stripe_user_id

        _upsert_integration_row(
            user_id,
            "stripe",
            {
                "selected": True,
                "status": "connected",
                "connected_email": connected_email,
                "scopes": [token_data.get("scope") or STRIPE_CONNECT_SCOPE],
                "provider_metadata": {
                    "account_id": stripe_user_id,
                    "display_name": display_name,
                    "business_url": business_profile.get("url"),
                    "charges_enabled": bool(account.get("charges_enabled")),
                    "payouts_enabled": bool(account.get("payouts_enabled")),
                    "details_submitted": bool(account.get("details_submitted")),
                    "livemode": livemode,
                    "connected_at": datetime.now(timezone.utc).isoformat(),
                },
                "credentials": {
                    "stripe_user_id": stripe_user_id,
                    "livemode": livemode,
                },
            },
        )
        success = True
        message = "Stripe connected."
    except HTTPException as exc:
        message = exc.detail
    except Exception as exc:
        logging.error('main.stripe_integration_callback.event_12652')
        message = "Stripe could not be connected."

    callback_payload = script_safe_json({
        "type": "sonar.integration.oauth_complete",
        "provider": "stripe",
        "success": success,
        "message": message,
    })
    safe_target = script_safe_json(frontend_target)
    html = f"""
    <!doctype html>
    <html>
      <body style="font-family: Inter, sans-serif; background:#09090b; color:#fff; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0;">
        <div style="text-align:center;">
          <div style="font-size:18px; font-weight:600; margin-bottom:8px;">{escape_html(str(message))}</div>
          <div style="font-size:13px; color:rgba(255,255,255,0.6);">You can close this window.</div>
        </div>
        <script>
          (function() {{
            const payload = {callback_payload};
            const targetOrigin = (function() {{
              try {{
                return new URL({safe_target}, window.location.origin).origin;
              }} catch (e) {{
                return window.location.origin;
              }}
            }})();
            if (window.opener && !window.opener.closed) {{
              window.opener.postMessage(payload, targetOrigin);
            }}
            setTimeout(function() {{ window.close(); }}, 350);
          }})();
        </script>
      </body>
    </html>
    """
    return HTMLResponse(content=html)


@app.post("/users/me/integrations/{provider}/disconnect", response_model=IntegrationDisconnectResponse, tags=["Users"])
async def disconnect_user_integration(provider: str, current_user: dict = Depends(get_current_user)):
    provider = provider.lower().strip()
    if provider not in SUPPORTED_INTEGRATION_PROVIDERS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Integration provider not supported.")
    current_user_id = business_owner_id(current_user)
    if provider == "stripe":
        _deauthorize_stripe_integration(_fetch_integration_row(current_user_id, provider))
    _upsert_integration_row(
        current_user_id,
        provider,
        {
            "status": "disconnected",
            "selected": False,
            "connected_email": None,
            "scopes": [],
            "provider_metadata": {},
            "credentials": {},
        },
    )
    return {"success": True, "provider": provider}


@app.get("/users/me/integrations/{provider}/messages", response_model=List[IntegrationEmailListItem], tags=["Users"])
async def list_integration_messages(
    provider: str,
    limit: int = 20,
    current_user: dict = Depends(get_current_user),
):
    provider = provider.lower().strip()
    if provider not in SUPPORTED_EMAIL_INTEGRATION_PROVIDERS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Integration provider not supported.")
    limit = max(1, min(limit, 50))

    if provider == "outlook":
        params = {"$top": limit, "$select": "id,conversationId,subject,from,toRecipients,bodyPreview,receivedDateTime,body", "$orderby": "receivedDateTime desc"}
        response = _outlook_api_request(business_owner_id(current_user), "GET", GRAPH_MESSAGES_URL, params=params)
        if not response.ok:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to load Outlook messages.")
        values = response.json().get("value") or []
        messages = [IntegrationEmailListItem.model_validate(_parse_outlook_message(msg)).model_dump() for msg in values]
    else:
        response = _gmail_api_request(business_owner_id(current_user), "GET", GMAIL_MESSAGES_URL, params={"maxResults": limit})
        if not response.ok:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to load Gmail messages.")
        message_refs = response.json().get("messages") or []
        messages = []
        for ref in message_refs:
            msg_response = _gmail_api_request(
                business_owner_id(current_user),
                "GET",
                f"{GMAIL_MESSAGES_URL}/{ref.get('id')}",
                params={"format": "full"},
            )
            if not msg_response.ok:
                continue
            messages.append(IntegrationEmailListItem.model_validate(_parse_gmail_message(msg_response.json())).model_dump())
    return messages


@app.get("/users/me/integrations/{provider}/messages/{message_id}", response_model=IntegrationEmailMessageResponse, tags=["Users"])
async def get_integration_message(
    provider: str,
    message_id: str,
    current_user: dict = Depends(get_current_user),
):
    provider = provider.lower().strip()
    if provider not in SUPPORTED_EMAIL_INTEGRATION_PROVIDERS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Integration provider not supported.")

    if provider == "outlook":
        response = _outlook_api_request(
            business_owner_id(current_user),
            "GET",
            f"{GRAPH_MESSAGES_URL}/{message_id}",
        )
        if not response.ok:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to load Outlook message.")
        result = response.json()
        # Fetch full body if truncated
        if (result.get("body") or {}).get("contentType") != "text":
            body_response = _outlook_api_request(
                business_owner_id(current_user),
                "GET",
                f"{GRAPH_MESSAGES_URL}/{message_id}?$select=id,body",
            )
            if body_response.ok:
                body_data = body_response.json().get("body") or {}
                if body_data.get("contentType") == "text":
                    result["body"] = body_data
        return IntegrationEmailMessageResponse.model_validate(_parse_outlook_message(result)).model_dump()
    else:
        response = _gmail_api_request(
            business_owner_id(current_user),
            "GET",
            f"{GMAIL_MESSAGES_URL}/{message_id}",
            params={"format": "full"},
        )
    if not response.ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to load Gmail message.")
    return IntegrationEmailMessageResponse.model_validate(_parse_gmail_message(response.json())).model_dump()


@app.post("/users/me/integrations/{provider}/send-email", response_model=IntegrationEmailSendResponse, tags=["Users"])
async def send_integration_email(
    provider: str,
    payload: IntegrationEmailSendRequest,
    current_user: dict = Depends(get_current_user),
):
    provider = provider.lower().strip()
    if provider not in SUPPORTED_EMAIL_INTEGRATION_PROVIDERS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Email sending is not available for this provider.")

    if provider == "outlook":
        result = _send_outlook_email_for_user(business_owner_id(current_user), payload.to, payload.subject, payload.body)
    else:
        result = _send_gmail_email_for_user(business_owner_id(current_user), payload.to, payload.subject, payload.body)
    return {
        "id": result.get("id"),
        "thread_id": result.get("thread_id") or result.get("threadId"),
        "label_ids": result.get("labelIds") or [],
    }

@app.put("/users/me", tags=["Users"])
async def update_user_profile(user_update_data: UserUpdate, current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    update_data = user_update_data.model_dump(exclude_unset=True, include={"full_name", "phone", "pref_card_size", "hide_tutorial_modal"})
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
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='The request could not be completed')

@app.post("/users/me/login-status", status_code=status.HTTP_204_NO_CONTENT, tags=["Users"])
async def update_login_status(status_update: LoginStatusUpdate, current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    try:
        update_data = status_update.model_dump()
        supabase.table('users').update(update_data).eq('id', str(current_user_id)).execute()
    except Exception as e:
        logging.error('main.update_login_status.event_12846')

@app.post("/users/me/onboarding/prepare", status_code=status.HTTP_200_OK, tags=["Users"])
async def prepare_onboarding(current_user: dict = Depends(get_current_user)):
    """Ensure the public profile exists before the onboarding form is shown."""
    current_user_id = str(current_user.id)
    try:
        existing = (
            supabase_admin.table('users')
            .select('id')
            .eq('id', current_user_id)
            .limit(1)
            .execute()
        )
        if not existing.data:
            user_metadata = getattr(current_user, "user_metadata", {}) or {}
            profile_data = {
                "id": current_user_id,
                "email": current_user.email,
                "full_name": user_metadata.get("full_name") or user_metadata.get("name"),
                "phone": user_metadata.get("phone"),
                "onboarded": False,
            }
            supabase_admin.table('users').insert(profile_data).execute()
        return {"ready": True, "user_id": current_user_id}
    except Exception as e:
        logging.error('main.prepare_onboarding.event_12872')
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to prepare onboarding data.",
        )

@app.post("/users/me/onboarding", status_code=status.HTTP_200_OK, tags=["Users"])
async def complete_onboarding(
    onboarding_data: OnboardingRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    current_user_id = business_owner_id(current_user)

    try:
        if onboarding_data.mark_onboarded and not (onboarding_data.business_name or '').strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Business name is required to start onboarding.",
            )

        normalized_business_hours = normalize_onboarding_schedule(onboarding_data.business_hours or {})
        existing_terms_response = (
            supabase_admin.table('users')
            .select('terms_of_service')
            .eq('id', current_user_id)
            .limit(1)
            .execute()
        )
        existing_terms = ((existing_terms_response.data or [{}])[0].get('terms_of_service') or {})
        if not isinstance(existing_terms, dict):
            existing_terms = {}
        supplied_terms = onboarding_data.terms_of_service or {}
        if not isinstance(supplied_terms, dict):
            supplied_terms = {}
        merged_terms = {**existing_terms, **supplied_terms}
        user_update = {
            "phone": onboarding_data.business_phone,
            "terms_of_service": merged_terms,
        }
        if onboarding_data.mark_onboarded:
            user_update["onboarded"] = True
        supabase.table('users').update(user_update).eq('id', current_user_id).execute()

        business_payload = {
            "name": onboarding_data.business_name or "",
            "phone": onboarding_data.business_phone,
            "email": onboarding_data.business_email,
            "address": onboarding_data.business_street,
            "city": onboarding_data.business_city,
            "state": onboarding_data.business_state,
            "zip": onboarding_data.business_zip,
            "about_us": onboarding_data.about_company or "",
            "policies": onboarding_data.policies or "",
            "faq": onboarding_data.faq or "",
            "business_hours": json.dumps(normalized_business_hours),
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

        business = business_response.data[0] if business_response.data else None
        business_id = business.get("id") if business else (existing_business or {}).get("id")

        if business_id and onboarding_data.services:
            service_rows = []
            for index, service in enumerate(onboarding_data.services):
                service_name = str(service.get("name") or "").strip()
                if not service_name:
                    continue

                price_type = service.get("price_type") or "fixed"
                price_min = service.get("price_min")
                price_max = service.get("price_max")

                if price_type in ("quote", "free"):
                    price_min = None
                    price_max = None
                elif price_type != "range":
                    price_max = None

                service_rows.append({
                    "id": str(uuid4()),
                    "business_id": business_id,
                    "user_id": current_user_id,
                    "name": service_name,
                    "description": service.get("description") or "",
                    "category": str(service.get("category") or "General").strip() or "General",
                    "unit": service.get("unit") or "",
                    "price_type": price_type,
                    "price_min": price_min,
                    "price_max": price_max,
                    "is_active": service.get("is_active") is not False,
                    "sort_order": index,
                })

            if service_rows:
                supabase.table("services").delete().eq("business_id", business_id).eq("user_id", current_user_id).execute()
                supabase.table("services").insert(service_rows).execute()

        return {
            "onboarded": onboarding_data.mark_onboarded,
            "business": business,
        }
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='The request could not be completed',
        )
    except Exception as e:
        logging.error('main.complete_onboarding.event_13007')
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save onboarding data.",
        )


@app.get("/businesses/me/forwarding", tags=["Businesses"])
async def get_business_forwarding(
    current_user: dict = Depends(get_current_user),
):
    current_user_id = business_owner_id(current_user)

    try:
        business = get_business_record_for_user(current_user_id)
        maybe_auto_verify_business_forwarding_from_recent_twilio_call(business)
        business = get_business_record_for_user(current_user_id)
        maybe_sync_business_caller_id_verification_from_twilio(business)
        business = get_business_record_for_user(current_user_id)
        config = normalize_forwarding_config(business.get('forwarding_config'))
        purchase_limit = get_system_number_purchase_limit()
        purchase_count = get_business_number_purchase_count(business)

        current_entry = None
        if config.get("active_number_id"):
            current_entry = next(
                (entry for entry in config["numbers"] if entry.get("id") == config["active_number_id"]),
                None,
            )

        return {
            "business_id": business["id"],
            "business_name": business.get("name"),
            "business_phone": business.get("phone"),
            "forwarding_target_number": get_business_forwarding_target_number(business),
            "forwarding_config": config,
            "current_entry": current_entry,
            "twilio_number": business.get("twilio_number"),
            "twilio_number_status": business.get("twilio_number_status"),
            "twilio_number_label": business.get("twilio_number_label"),
            "twilio_number_quality_error": business.get("twilio_number_quality_error"),
            "quality_check_status": business.get("quality_check_status"),
            "quality_checked_at": business.get("quality_checked_at"),
            "number_purchase_count": purchase_count,
            "total_allowed_number_purchases": purchase_limit,
            "verify_caller_id": get_system_verify_caller_id_enabled(),
            "can_purchase_number": purchase_count < purchase_limit,
            "number_selection_required": str(business.get("twilio_number_status") or "").lower() != "active",
            "default_area_code": extract_us_area_code(business.get("phone")),
            "default_near_number": normalize_phone_number(business.get("phone")),
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error('main.get_business_forwarding.event_13061')
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load forwarding settings.",
        )


@app.get("/businesses/me/forwarding/available-numbers", tags=["Businesses"])
async def search_business_forwarding_numbers(
    area_code: Optional[str] = None,
    contains: Optional[str] = None,
    near_number: Optional[str] = None,
    region: Optional[str] = None,
    limit: int = 100,
    current_user: dict = Depends(get_current_user),
):
    current_user_id = business_owner_id(current_user)

    try:
        business = get_business_record_for_user(current_user_id)
        purchase_limit = get_system_number_purchase_limit()
        purchase_count = get_business_number_purchase_count(business)

        resolved_near_number = near_number or None
        resolved_area_code = area_code or extract_us_area_code(business.get("phone"))
        if resolved_near_number:
            resolved_area_code = None

        filters = {
            "area_code": resolved_area_code,
            "contains": contains or None,
            "near_number": resolved_near_number,
            "region": region or None,
            "limit": limit,
        }
        options = search_available_twilio_numbers(**filters)

        return {
            "options": options,
            "filters": filters,
            "number_purchase_count": purchase_count,
            "total_allowed_number_purchases": purchase_limit,
            "can_purchase_number": purchase_count < purchase_limit,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logging.error('main.search_business_forwarding_numbers.event_13108')
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load available phone numbers.",
        )


@app.post("/businesses/me/forwarding/claim-number", tags=["Businesses"])
async def claim_business_forwarding_number(
    payload: BusinessForwardingNumberClaimRequest,
    current_user: dict = Depends(get_current_user),
):
    current_user_id = business_owner_id(current_user)

    try:
        business = get_business_record_for_user(current_user_id)
        logging.info('main.claim_business_forwarding_number.event_13189')
        previous_active_purchased_number = get_active_purchased_number_for_business(
            int(business["id"]),
            kind="assigned_line",
        )
        previous_elevenlabs_phone_number_id = (
            previous_active_purchased_number or {}
        ).get("elevenlabs_phone_number_id")
        updated_business, purchased, purchased_row = purchase_specific_twilio_number_for_business(
            business,
            payload.phone_number,
            payload.label or business.get("name") or "Dedicated forwarding line",
        )
        logging.info('main.claim_business_forwarding_number.event_13208')

        elevenlabs_business = ensure_elevenlabs_phone_number_for_business(updated_business)
        phone_number_id = elevenlabs_business.get("elevenlabs_phone_number_id") or find_elevenlabs_phone_number(
            elevenlabs_business.get("twilio_number")
        )
        if isinstance(phone_number_id, dict):
            phone_number_id = phone_number_id.get("phone_number_id")

        if not phone_number_id:
            logging.warning('main.claim_business_forwarding_number.event_13147')
            release_twilio_number_by_sid(purchased.get("sid"))
            save_purchased_number_record(
                int(business["id"]),
                purchased.get("phone_number") or payload.phone_number,
                {
                    "friendly_name": payload.label or business.get("name") or "Dedicated forwarding line",
                    "status": "quality_failed",
                    "is_active": False,
                    "twilio_account_sid": twilio_account_sid,
                    "twilio_incoming_phone_number_sid": purchased.get("sid"),
                    "quality_check_status": "failed",
                    "quality_failure_reason": "We couldn't finish preparing that number. Please choose another one.",
                    "released_at": datetime.now(timezone.utc).isoformat(),
                    "released_reason": "elevenlabs_import_failed",
                },
            )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="We couldn't finish preparing that number. Please choose another one.",
            )

        test_call = start_number_quality_test_call(
            str(phone_number_id),
            payload.label or elevenlabs_business.get("name") or "Dedicated forwarding line",
        )
        logging.info('main.claim_business_forwarding_number.event_13255')
        quality_result = await wait_for_twilio_quality_test_result(
            test_call.get("callSid") or test_call.get("call_sid")
        )
        logging.info('main.claim_business_forwarding_number.event_13265')

        if not quality_result.get("passed"):
            delete_elevenlabs_phone_number(str(phone_number_id))
            release_twilio_number_by_sid(purchased.get("sid"))
            failure_message = "That number didn't pass our quick quality check. Pick another one and we'll try again."
            save_purchased_number_record(
                int(business["id"]),
                purchased.get("phone_number") or payload.phone_number,
                {
                    "friendly_name": payload.label or business.get("name") or "Dedicated forwarding line",
                    "status": "quality_failed",
                    "is_active": False,
                    "twilio_account_sid": twilio_account_sid,
                    "twilio_incoming_phone_number_sid": purchased.get("sid"),
                    "elevenlabs_phone_number_id": None,
                    "quality_check_status": "failed",
                    "quality_checked_at": datetime.now(timezone.utc).isoformat(),
                    "quality_failure_reason": failure_message,
                    "released_at": datetime.now(timezone.utc).isoformat(),
                    "released_reason": "quality_failed",
                },
            )
            cleared_business = hydrate_business_with_purchased_number_data(business) or business
            logging.warning('main.claim_business_forwarding_number.event_13206')

            return {
                "ok": False,
                "verified": False,
                "message": failure_message,
                "technical_reason": quality_result.get("technical_reason"),
                "twilio_number_status": cleared_business.get("twilio_number_status"),
                "quality_check_status": "failed",
                "quality_checked_at": datetime.now(timezone.utc).isoformat(),
                "twilio_number_quality_error": failure_message,
                "number_purchase_count": get_business_number_purchase_count(cleared_business),
                "total_allowed_number_purchases": get_system_number_purchase_limit(),
            }

        activated_row = save_purchased_number_record(
            int(business["id"]),
            elevenlabs_business.get("twilio_number"),
            {
                "friendly_name": payload.label or elevenlabs_business.get("name") or elevenlabs_business.get("twilio_number_label"),
                "status": "active",
                "is_active": True,
                "twilio_account_sid": twilio_account_sid,
                "twilio_incoming_phone_number_sid": purchased.get("sid"),
                "elevenlabs_phone_number_id": str(phone_number_id),
                "quality_check_status": "passed",
                "quality_checked_at": datetime.now(timezone.utc).isoformat(),
                "quality_failure_reason": None,
            },
        )
        deactivate_other_purchased_numbers(int(business["id"]), activated_row.get("id"), kind="assigned_line")
        if (
            previous_elevenlabs_phone_number_id
            and str(previous_elevenlabs_phone_number_id) != str(phone_number_id)
        ):
            delete_elevenlabs_phone_number(str(previous_elevenlabs_phone_number_id))
        activated_business = hydrate_business_with_purchased_number_data(business) or business
        logging.info('main.claim_business_forwarding_number.event_13342')

        push_live_event(
            "Dedicated Twilio number passed quality check.",
            actor="system",
            severity="info",
            event_type="twilio_number_quality_verified",
            payload={
                "business_id": business.get("id"),
                "twilio_number": activated_business.get("twilio_number"),
                "phone_number_id": phone_number_id,
            },
        )

        return {
            "ok": True,
            "verified": True,
            "message": "This number passed our quick quality check and is ready to use.",
            "twilio_number": activated_business.get("twilio_number"),
            "twilio_number_label": activated_business.get("twilio_number_label"),
            "twilio_number_status": activated_business.get("twilio_number_status"),
            "quality_check_status": "passed",
            "quality_checked_at": activated_row.get("quality_checked_at"),
            "twilio_number_quality_error": None,
            "elevenlabs_phone_number_id": str(phone_number_id),
            "number_purchase_count": get_business_number_purchase_count(activated_business),
            "total_allowed_number_purchases": get_system_number_purchase_limit(),
        }
    except HTTPException:
        raise
    except Exception as exc:
        logging.error('main.claim_business_forwarding_number.event_13282')
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to set up that phone number.",
        )


@app.post("/businesses/me/forwarding/caller-id/start", tags=["Businesses"])
async def start_business_forwarding_caller_id_verification(
    payload: BusinessCallerIdVerificationStartRequest,
    current_user: dict = Depends(get_current_user),
):
    current_user_id = business_owner_id(current_user)

    try:
        if not get_system_verify_caller_id_enabled():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Caller ID verification is currently turned off.")
        business = get_business_record_for_user(current_user_id)
        config = normalize_forwarding_config(business.get("forwarding_config"))
        entry = None
        entry_index = None

        if payload.entry_id or payload.source_number:
            entry, entry_index = get_forwarding_entry(config, entry_id=payload.entry_id, source_number=payload.source_number)
        if entry is None:
            entry = get_active_forwarding_entry(config)
            if entry:
                _, entry_index = get_forwarding_entry(config, entry_id=entry.get("id"))

        if entry is None or entry_index is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Choose a saved business number before verifying caller ID.")

        source_number = normalize_phone_number(entry.get("source_number"))
        if not source_number:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="That business number is missing or invalid.")

        friendly_name = payload.source_label or entry.get("source_label") or business.get("name") or source_number
        now = datetime.now(timezone.utc).isoformat()

        existing_caller_id = find_twilio_outgoing_caller_id(source_number)
        if existing_caller_id:
            phone_number_id = ensure_elevenlabs_outbound_caller_id(source_number, friendly_name)
            numbers = config.get("numbers", [])
            next_entry = {
                **entry,
                "caller_id_verification_status": "verified",
                "caller_id_phone_number": source_number,
                "caller_id_outgoing_caller_id_sid": existing_caller_id.get("sid"),
                "caller_id_requested_at": entry.get("caller_id_requested_at") or now,
                "caller_id_verified_at": now,
                "caller_id_validation_code": None,
                "caller_id_call_sid": None,
                "caller_id_failure_reason": None,
                "caller_id_elevenlabs_phone_number_id": phone_number_id,
                "updated_at": now,
            }
            numbers[entry_index] = next_entry
            config["numbers"] = numbers
            persist_business_forwarding_config(business["id"], config)
            return {
                "ok": True,
                "entry": next_entry,
                "message": "Your business number is already verified for outbound caller ID.",
            }

        verification = start_twilio_outgoing_caller_id_verification(
            source_number,
            friendly_name=friendly_name,
            extension=payload.extension,
        )
        numbers = config.get("numbers", [])
        next_entry = {
            **entry,
            "caller_id_verification_status": "pending",
            "caller_id_phone_number": source_number,
            "caller_id_outgoing_caller_id_sid": None,
            "caller_id_requested_at": now,
            "caller_id_verified_at": None,
            "caller_id_validation_code": verification.get("validation_code") or verification.get("validationCode"),
            "caller_id_call_sid": verification.get("call_sid") or verification.get("callSid"),
            "caller_id_failure_reason": None,
            "caller_id_elevenlabs_phone_number_id": None,
            "updated_at": now,
        }
        numbers[entry_index] = next_entry
        config["numbers"] = numbers
        persist_business_forwarding_config(business["id"], config)

        push_live_event(
            "Business caller ID verification started.",
            actor="system",
            severity="info",
            event_type="business_caller_id_verification_started",
            payload={
                "business_id": business["id"],
                "entry_id": next_entry.get("id"),
                "source_number": source_number,
            },
        )

        return {
            "ok": True,
            "entry": next_entry,
            "message": "Answer the verification call to your business line and enter the code shown here.",
        }
    except HTTPException:
        raise
    except Exception as exc:
        logging.error('main.start_business_forwarding_caller_id_verification.event_13390')
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to start caller ID verification.",
        )


@app.post("/twilio/outgoing-caller-id/status", tags=["Twilio"])
async def twilio_outgoing_caller_id_status(request: Request):
    await verify_twilio_webhook_request(request, get_twilio_caller_id_status_callback_url())
    try:
        form = await request.form()
        payload = dict(form)
    except Exception:
        payload = {}

    call_sid = payload.get("CallSid") or payload.get("CallSid".lower()) or payload.get("call_sid")
    verification_status = str(payload.get("VerificationStatus") or payload.get("verification_status") or "").strip().lower()
    outgoing_caller_id_sid = payload.get("OutgoingCallerIdSid") or payload.get("outgoing_caller_id_sid")
    called_number = normalize_phone_number(payload.get("To") or payload.get("Called") or payload.get("PhoneNumber"))
    now = datetime.now(timezone.utc).isoformat()

    try:
        response = supabase.table("businesses").select("id,name,forwarding_config").execute()
        businesses = response.data or []
    except Exception as exc:
        logging.error('main.twilio_outgoing_caller_id_status.event_13397')
        return Response(status_code=200)

    for business in businesses:
        config = normalize_forwarding_config(business.get("forwarding_config"))
        numbers = config.get("numbers", [])
        matched_index = None
        matched_entry = None

        for index, entry in enumerate(numbers):
            entry_call_sid = entry.get("caller_id_call_sid")
            entry_source_number = normalize_phone_number(entry.get("source_number"))
            if call_sid and entry_call_sid == call_sid:
                matched_index = index
                matched_entry = entry
                break
            if called_number and entry_source_number == called_number and str(entry.get("caller_id_verification_status") or "").lower() == "pending":
                matched_index = index
                matched_entry = entry
                break

        if matched_entry is None or matched_index is None:
            continue

        if verification_status == "success":
            phone_number_id = ensure_elevenlabs_outbound_caller_id(
                normalize_phone_number(matched_entry.get("source_number")) or matched_entry.get("source_number") or "",
                matched_entry.get("source_label") or business.get("name") or "Verified Caller ID",
            )
            numbers[matched_index] = {
                **matched_entry,
                "caller_id_verification_status": "verified",
                "caller_id_outgoing_caller_id_sid": outgoing_caller_id_sid or matched_entry.get("caller_id_outgoing_caller_id_sid"),
                "caller_id_verified_at": now,
                "caller_id_validation_code": None,
                "caller_id_failure_reason": None,
                "caller_id_elevenlabs_phone_number_id": phone_number_id,
                "updated_at": now,
            }
            config["numbers"] = numbers
            persist_business_forwarding_config(business["id"], config)
            push_live_event(
                "Business caller ID verified.",
                actor="system",
                severity="info",
                event_type="business_caller_id_verified",
                payload={
                    "business_id": business.get("id"),
                    "entry_id": matched_entry.get("id"),
                    "source_number": matched_entry.get("source_number"),
                },
            )
        else:
            numbers[matched_index] = {
                **matched_entry,
                "caller_id_verification_status": "failed",
                "caller_id_failure_reason": "We couldn't verify that business number yet. Try again when someone can answer the line.",
                "caller_id_validation_code": None,
                "updated_at": now,
            }
            config["numbers"] = numbers
            persist_business_forwarding_config(business["id"], config)
            push_live_event(
                "Business caller ID verification failed.",
                actor="system",
                severity="warning",
                event_type="business_caller_id_verification_failed",
                payload={
                    "business_id": business.get("id"),
                    "entry_id": matched_entry.get("id"),
                    "source_number": matched_entry.get("source_number"),
                },
            )
        break

    return Response(status_code=200)


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
            "Business Line" if payload.source_number == business.get("phone") else payload.source_number
        )
        provider_label = payload.provider_label or payload.provider

        confirmed_enabled_at = (existing_entry or {}).get("confirmed_enabled_at")
        verified_at = (existing_entry or {}).get("verified_at")
        source_number_changed = normalize_phone_number((existing_entry or {}).get("source_number")) != normalize_phone_number(payload.source_number)

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
            "agent_id": payload.agent_id or (existing_entry or {}).get("agent_id"),
            "source_number": payload.source_number,
            "source_label": source_label,
            "provider": payload.provider,
            "provider_label": provider_label,
            "target_number": get_business_forwarding_target_number(business),
            "status": next_status,
            "confirmed_enabled_at": confirmed_enabled_at,
            "verified_at": verified_at,
            "caller_id_verification_status": None if source_number_changed else (existing_entry or {}).get("caller_id_verification_status"),
            "caller_id_phone_number": None if source_number_changed else (existing_entry or {}).get("caller_id_phone_number"),
            "caller_id_outgoing_caller_id_sid": None if source_number_changed else (existing_entry or {}).get("caller_id_outgoing_caller_id_sid"),
            "caller_id_requested_at": None if source_number_changed else (existing_entry or {}).get("caller_id_requested_at"),
            "caller_id_verified_at": None if source_number_changed else (existing_entry or {}).get("caller_id_verified_at"),
            "caller_id_validation_code": None if source_number_changed else (existing_entry or {}).get("caller_id_validation_code"),
            "caller_id_call_sid": None if source_number_changed else (existing_entry or {}).get("caller_id_call_sid"),
            "caller_id_failure_reason": None if source_number_changed else (existing_entry or {}).get("caller_id_failure_reason"),
            "caller_id_elevenlabs_phone_number_id": None if source_number_changed else (existing_entry or {}).get("caller_id_elevenlabs_phone_number_id"),
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

        if payload.agent_id and next_status == "verified":
            agent_lookup = (
                supabase
                .table('hired_receptionists')
                .select('id,status,direction')
                .eq('id', payload.agent_id)
                .eq('user_id', current_user_id)
                .limit(1)
                .execute()
            )
            agent_row = (agent_lookup.data or [None])[0]
            if agent_row:
                next_agent_status = derive_receptionist_status(
                    agent_row.get('status'),
                    preserve_offline=False,
                    direction=agent_row.get('direction'),
                )
                supabase.table('hired_receptionists').update({
                    'status': next_agent_status,
                }).eq('id', payload.agent_id).execute()

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

        if next_status == "pending_test" and business.get("id") and next_entry.get("id") and next_entry.get("target_number"):
            schedule_twilio_inbound_forwarding_verification_watch(
                int(business["id"]),
                str(next_entry["id"]),
                str(next_entry["target_number"]),
                now,
            )

        return {
            "business_id": business["id"],
            "business_phone": business.get("phone"),
            "forwarding_target_number": get_business_forwarding_target_number(business),
            "forwarding_config": config,
            "entry": next_entry,
            "twilio_number_status": business.get("twilio_number_status"),
            "twilio_number_label": business.get("twilio_number_label"),
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error('main.update_business_forwarding.event_13622')
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
        logging.error('main.get_leads_for_user.event_13641')
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail='The request could not be completed'
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
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='The request could not be completed')

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
        logging.error('main.update_lead_for_user.event_13685')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='The request could not be completed')

@app.delete("/leads/{lead_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Leads"])
async def delete_lead_for_user(lead_id: UUID, current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    try:
        ownership_check = supabase.table('leads').select('id').eq('id', str(lead_id)).eq('user', str(current_user_id)).single().execute()
        if not ownership_check.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found or you do not have permission to delete it.")
        supabase.table('leads').delete().eq('id', str(lead_id)).execute()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='The request could not be completed')

# --- Purchases Endpoints ---
@app.post("/purchases", response_model=PurchaseResponse, status_code=status.HTTP_201_CREATED, tags=["Purchases"])
async def create_purchase(purchase_data: PurchaseCreate, current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    try:
        lead_owner_check = supabase.table('leads').select('user').eq('id', str(purchase_data.lead)).single().execute()
    except Exception as e:
        logging.error('main.create_purchase.event_13706')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error checking lead ownership.")

    if not lead_owner_check.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='The request could not be completed')

    lead_owner_id = lead_owner_check.data['user']

    if str(lead_owner_id) != str(current_user_id):
        logging.warning('main.create_purchase.event_13832')
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
        logging.error('main.create_purchase.event_13733')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='The request could not be completed')

@app.put("/purchases/{purchase_id}", response_model=PurchaseResponse, tags=["Purchases"])
async def update_purchase(purchase_id: UUID, purchase_update: PurchaseUpdate, current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    try:
        owner_check = supabase.table('purchases').select('user').eq('id', str(purchase_id)).single().execute()
    except Exception as e:
        logging.error('main.update_purchase.event_13742')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error checking purchase ownership.")

    if not owner_check.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='The request could not be completed')

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
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='The request could not be completed')

@app.delete("/purchases/{purchase_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Purchases"])
async def delete_purchase(purchase_id: UUID, current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    try:
        owner_check = supabase.table('purchases').select('user').eq('id', str(purchase_id)).single().execute()
    except Exception as e:
        logging.error('main.delete_purchase.event_13772')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error checking purchase ownership.")
    
    if not owner_check.data:
        return

    if str(owner_check.data['user']) != str(current_user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied.")

    try:
        supabase.table('purchases').delete().eq('id', str(purchase_id)).execute()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='The request could not be completed')

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
        logging.error('main.submit_helpdesk_message.event_13801')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='The request could not be completed')
    




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
        logging.error('main.get_available_ai_agents.event_13822')
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
        logging.error('main.create_campaign.event_13840')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='The request could not be completed')

@app.get("/campaigns", response_model=List[CampaignResponse], tags=["Campaigns"])
async def get_campaigns(current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    try:
        response = supabase.table('campaigns').select('*').eq('user', str(current_user_id)).execute()
        return response.data
    except Exception as e:
        logging.error('main.get_campaigns.event_13850')
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
        logging.error('main.get_campaign.event_13862')
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
        logging.error('main.update_campaign.event_13882')
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
        logging.error('main.delete_campaign.event_13895')
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
        logging.error('main.create_prize.event_13911')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='The request could not be completed')

@app.get("/prizes", response_model=List[PrizeResponse], tags=["Prizes"])
async def get_all_prizes(current_rep_id: str = Depends(get_current_rep)):
    try:
        response = supabase.table('prizes').select('*').execute()
        return response.data
    except Exception as e:
        logging.error('main.get_all_prizes.event_13920')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve prizes")

@app.get("/prizes/{prize_id}", response_model=PrizeResponse, tags=["Prizes"])
async def get_prize(prize_id: UUID, current_rep_id: str = Depends(get_current_rep)):
    try:
        response = supabase.table('prizes').select('*').eq('id', str(prize_id)).single().execute()
        if not response.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prize not found")
        return response.data
    except Exception as e:
        logging.error('main.get_prize.event_13931')
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
        logging.error('main.update_prize.event_13946')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update prize")

@app.delete("/prizes/{prize_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Prizes"])
async def delete_prize(prize_id: UUID, current_rep_id: str = Depends(get_current_rep)):
    try:
        response = supabase.table('prizes').delete().eq('id', str(prize_id)).execute()
        if not response.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prize not found")
    except Exception as e:
        logging.error('main.delete_prize.event_13956')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete prize")

@app.post("/prizes/{prize_id}/redeem", response_model=RepResponse, tags=["Prizes"])
async def redeem_prize(prize_id: UUID, current_rep_id: str = Depends(get_current_rep)):
    logging.info('main.redeem_prize.event_14179')
    try:
        # 1. Fetch prize details
        logging.info('main.redeem_prize.event_14081')
        prize_response = supabase.table('prizes').select('name, points').eq('id', str(prize_id)).single().execute()
        
        if not prize_response.data:
            logging.warning('main.redeem_prize.event_13968')
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prize not found.")
        
        prize = prize_response.data
        prize_cost = prize.get('points', 0)
        logging.info('main.redeem_prize.event_14090')

        # 2. Fetch rep profile
        logging.info('main.redeem_prize.event_14093')
        rep_response = supabase.table('reps').select('id, points, first_name, last_name').eq('rep_id', current_rep_id).single().execute()
        
        if not rep_response.data:
            logging.warning('main.redeem_prize.event_13980')
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Representative profile not found.")
        
        rep = rep_response.data
        rep_current_points = rep.get('points', 0)
        rep_db_id = rep.get('id')
        rep_first_name = rep.get('first_name')
        rep_last_name = rep.get('last_name')
        logging.info('main.redeem_prize.event_14058')

        # 3. Check if rep has enough points
        if rep_current_points < prize_cost:
            logging.warning('main.redeem_prize.event_13992')
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Insufficient points to redeem this prize.")

        # 4. Deduct points from rep and increment prize purchases_count
        updated_rep_points = rep_current_points - prize_cost
        logging.info('main.redeem_prize.event_14067')

        # Update rep's points
        update_rep_response = supabase.table('reps').update({'points': updated_rep_points}).eq('id', rep_db_id).execute()
        if update_rep_response.data:
            logging.info('main.redeem_prize.event_14002')
        else:
            logging.error('main.redeem_prize.event_14004')
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update representative's points.")
        
        # Increment prize's purchases_count using RPC
        logging.info('main.redeem_prize.event_14078')
        rpc_response = supabase.rpc('increment_prize_purchases_count', {'prize_id_param': str(prize_id)}).execute()
        logging.info('main.redeem_prize.event_14080')

        # Add rep info to prize purchases JSONB column
        rep_purchase_info = {"first_name": rep_first_name, "last_name": rep_last_name, "redeemed_at": datetime.now(timezone.utc).isoformat()}
        logging.info('main.redeem_prize.event_14084')
        add_purchase_response = supabase.rpc('add_rep_to_prize_purchases', {'prize_id_param': str(prize_id), 'rep_info_param': rep_purchase_info}).execute()
        logging.info('main.redeem_prize.event_14086')


        # 5. Fetch and return updated rep profile
        logging.info('main.redeem_prize.event_14090')
        updated_rep_profile_response = supabase.table('reps').select('*').eq('rep_id', current_rep_id).single().execute()
        if not updated_rep_profile_response.data:
            logging.error('main.redeem_prize.event_14023')
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve updated rep profile.")
        
        logging.info('main.redeem_prize.event_14096')
        return RepResponse.model_validate(updated_rep_profile_response.data).model_dump()

    except HTTPException as e:
        logging.error('main.redeem_prize.event_14030')
        raise e
    except Exception as e:
        logging.error('main.redeem_prize.event_14033')
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
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='The request could not be completed')

@app.post("/passwords", response_model=PasswordResponse, status_code=status.HTTP_201_CREATED, tags=["Passwords"])
async def create_password_for_user(password_data: PasswordCreate, current_user: dict = Depends(get_current_user)):
    user_response = supabase.table("users").select("*").eq("id", str(current_user.id)).single().execute()
    if not user_response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    user = user_response.data
    user_plan_name = user.get("plan")

    if not user_plan_name:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User does not have a subscription plan.")

    plan_response = supabase.table("plans").select("slug,entitlements").eq("slug", user_plan_name).single().execute()
    if not plan_response.data:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='The request could not be completed')
    
    plan_entitlements = plan_response.data.get("entitlements") or {}

    total_passwords_limit = plan_entitlements.get("total_passwords_limit")
    daily_passwords_limit = plan_entitlements.get("daily_passwords_limit")
    
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
        
        logging.info('main.create_password_for_user.event_14154') # Added logging
        insert_response = supabase.table('passwords').insert(new_password_data).execute()
        
        if not insert_response.data:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create password")
        
        supabase.rpc('increment_password_counts', {'user_id_param': str(current_user.id)}).execute()
            
        return insert_response.data[0]
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='The request could not be completed')

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
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='The request could not be completed')

@app.delete("/passwords/{password_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Passwords"])
async def delete_password_for_user(password_id: UUID, current_user: dict = Depends(get_current_user)):
    try:
        ownership_check = supabase.table('passwords').select('id').eq('id', str(password_id)).eq('user', str(current_user.id)).single().execute()
        if not ownership_check.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Password not found or you do not have permission to delete it.")
        
        supabase.table('passwords').delete().eq('id', str(password_id)).execute()

    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='The request could not be completed')

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
        logging.error('main.get_all_lead_campaigns.event_14147')
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
        logging.error('main.create_oauth_account.event_14164')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='The request could not be completed')

@app.get("/oauth", response_model=List[OAuthAccountResponse], tags=["OAuth"])
async def get_oauth_accounts(current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    try:
        response = supabase.table('oauth').select('*').eq('user', str(current_user_id)).execute()
        return response.data
    except Exception as e:
        logging.error('main.get_oauth_accounts.event_14174')
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
        logging.error('main.delete_oauth_account.event_14187')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='The request could not be completed')
