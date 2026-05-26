# main.py
  
import logging
import os
import stripe
import json
import time
import asyncio
import requests
from uuid import UUID, uuid4
from decimal import Decimal, InvalidOperation
from datetime import date, datetime, timezone, timedelta
from typing import List, Optional, Literal
from urllib.parse import urlsplit, urlunsplit
from email.utils import parsedate_to_datetime

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


class UvicornAccessFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        message = record.getMessage()
        if '"GET ' not in message:
            return True
        return not any(f'"GET {path}' in message for path in SUPPRESSED_ACCESS_LOG_PATHS)


# --- Logging Configuration ---
# Sets the root logger to output INFO level messages.
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')
logging.info("Logging configured.")
# Silence HTTPX / HTTPCORE internal debug logs
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("hpack").setLevel(logging.WARNING)
for handler in logging.getLogger("uvicorn.access").handlers:
    handler.addFilter(UvicornAccessFilter())

# --- End Logging Configuration ---

from pydantic import BaseModel, Field, EmailStr
from fastapi import FastAPI, HTTPException, status, Depends, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
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
    elevenlabs_api_key,
    elevenlabs_agent_id_inbound,
    elevenlabs_agent_id_outbound,
    twilio_phone_number,
    twilio_account_sid,
    twilio_auth_token,
    twilio_api_key,
    twilio_api_secret,
    twilio_voice_webhook_url,
)

 
from models import (
    UserUpdate, UserResponse, AuthSignUpRequest, LeadCreate,
    LeadResponse, AuthLoginRequest, LeadUpdate, PurchaseCreate,
    PurchaseUpdate, PurchaseResponse, CampaignItemResponse,
    CampaignCreate, CampaignUpdate, CampaignResponse, AIAgentResponse,
    AdminSetting, RepLoginRequest, MoneyTablePlan, MoneyTableRep, RepResponse, RepUpdate,
    PasswordCreate, PasswordUpdate, PasswordResponse, PrizeCreate, PrizeUpdate, PrizeResponse, TierResponse, HelpdeskMessage, OAuthAccountCreate, OAuthAccountResponse
)
from dependencies import get_current_user, get_current_rep
from scenario_engine import ScenarioEngine

# --------------------------------------------------------------------------
# App Initialization
# --------------------------------------------------------------------------
app = FastAPI(title="WYSL API")
# scheduler = AsyncIOScheduler()
PAYMENT_TEST_MODE = TEST_MODE

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
scenario_engine: Optional[ScenarioEngine] = None
PENDING_FORWARDING_VERIFICATION_TASKS: dict[str, asyncio.Task] = {}


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
        logging.warning("Failed to load purchased numbers for business %s: %s", business_id, exc)
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
            supabase
            .table("system_config")
            .select("total_allowed_number_purchases,verify_caller_id")
            .limit(1)
            .execute()
        )
        return (response.data or [None])[0] or {}
    except Exception as exc:
        logging.warning("Failed to load system_config: %s", exc)
        return {}


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
        logging.warning("Failed to deactivate purchased numbers for business %s: %s", business_id, exc)


def derive_receptionist_status(
    call_types: Optional[str],
    current_status: Optional[str] = None,
    *,
    preserve_offline: bool = True,
) -> str:
    normalized_current = str(current_status or "").strip().lower()
    if preserve_offline and normalized_current == "offline":
        return "Offline"
    normalized_call_types = str(call_types or "none").strip().lower()
    return "Idle" if normalized_call_types in {"", "none", "off"} else "Online"


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
            .select("id,call_types,status")
            .eq("id", str(agent_id))
            .limit(1)
            .execute()
        )
        agent_row = (agent_lookup.data or [None])[0]
        if agent_row:
            next_status = derive_receptionist_status(
                agent_row.get("call_types"),
                agent_row.get("status"),
                preserve_offline=False,
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
        logging.warning("Failed to look up Twilio verified caller ID for %s: %s", normalized, exc)
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
        logging.info("Deleting ElevenLabs phone number phone_number_id=%s", phone_number_id)
        response = requests.delete(
            f"https://api.elevenlabs.io/v1/convai/phone-numbers/{phone_number_id}",
            headers=headers,
            timeout=30,
        )
        response.raise_for_status()
    except Exception as exc:
        logging.warning("Failed to delete ElevenLabs phone number %s: %s", phone_number_id, exc)


def search_available_twilio_numbers(
    *,
    area_code: Optional[str] = None,
    contains: Optional[str] = None,
    near_number: Optional[str] = None,
    region: Optional[str] = None,
    limit: int = 12,
) -> list[dict]:
    auth = get_twilio_auth_tuple()
    if not twilio_account_sid or not auth:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Twilio provisioning is not configured.",
        )

    query_limit = max(1, min(limit, 20))
    search_params = {
        "VoiceEnabled": "true",
        "SmsEnabled": "true",
        "ExcludeAllAddressRequired": "true",
        "Limit": query_limit,
    }
    if area_code and str(area_code).isdigit():
        search_params["AreaCode"] = str(area_code)[:3]
    if contains:
        search_params["Contains"] = str(contains).strip()
    if near_number:
        normalized_near_number = normalize_phone_number(near_number)
        if normalized_near_number:
            search_params["NearNumber"] = normalized_near_number
            search_params["Distance"] = 100
    if region:
        search_params["InRegion"] = str(region).strip()[:2].upper()

    search_url = f"https://api.twilio.com/2010-04-01/Accounts/{twilio_account_sid}/AvailablePhoneNumbers/US/Local.json"
    response = requests.get(search_url, params=search_params, auth=auth, timeout=30)
    if not response.ok:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Twilio number search failed ({response.status_code}).",
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
        logging.info("Releasing Twilio number sid=%s", incoming_phone_number_sid)
        response = requests.delete(
            f"https://api.twilio.com/2010-04-01/Accounts/{twilio_account_sid}/IncomingPhoneNumbers/{incoming_phone_number_sid}.json",
            auth=auth,
            timeout=30,
        )
        response.raise_for_status()
    except Exception as exc:
        logging.warning("Failed to release Twilio number sid %s: %s", incoming_phone_number_sid, exc)


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
    logging.info(
        "Starting Twilio number purchase business_id=%s requested_number=%s label=%s purchase_count=%s purchase_limit=%s",
        business.get("id"),
        normalized_phone_number,
        purchase_payload["FriendlyName"],
        purchase_count,
        purchase_limit,
    )
    purchase_response = requests.post(incoming_url, data=purchase_payload, auth=auth, timeout=30)
    if not purchase_response.ok:
        detail = purchase_response.text
        logging.warning(
            "Twilio number purchase failed business_id=%s requested_number=%s status_code=%s detail=%s",
            business.get("id"),
            normalized_phone_number,
            purchase_response.status_code,
            detail[:300],
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Twilio number purchase failed ({purchase_response.status_code}): {detail[:200]}",
        )

    purchased = purchase_response.json() or {}
    logging.info(
        "Twilio number purchased business_id=%s requested_number=%s purchased_number=%s incoming_sid=%s",
        business.get("id"),
        normalized_phone_number,
        purchased.get("phone_number"),
        purchased.get("sid"),
    )
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
    logging.info(
        "Starting quality test call phone_number_id=%s outbound_agent_id=%s to=%s label=%s",
        phone_number_id,
        elevenlabs_agent_id_outbound,
        test_destination,
        label,
    )
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
                    "direction": "outgoing",
                    "mission": "Outbound deliverability quality check",
                },
            },
        },
        timeout=30,
    )
    response.raise_for_status()
    payload = response.json() or {}
    logging.info(
        "Quality test call created phone_number_id=%s call_sid=%s",
        phone_number_id,
        payload.get("callSid") or payload.get("call_sid"),
    )
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

        logging.info(
            "Twilio quality check status sid=%s status=%s duration=%s from=%s to=%s answered_by=%s",
            call_sid,
            call_status,
            duration_seconds,
            call.get("from"),
            call.get("to"),
            answered_by,
        )

        if call_status in success_statuses:
            logging.info(
                "Twilio quality check passed sid=%s poll=%s status=%s duration=%s",
                call_sid,
                poll_count,
                call_status,
                duration_seconds,
            )
            return {
                "passed": True,
                "status": call_status,
                "duration_seconds": duration_seconds,
            }

        if duration_seconds > 0:
            logging.info(
                "Twilio quality check passed via duration sid=%s poll=%s status=%s duration=%s",
                call_sid,
                poll_count,
                call_status,
                duration_seconds,
            )
            return {
                "passed": True,
                "status": call_status or "completed",
                "duration_seconds": duration_seconds,
            }

        if call_status in terminal_fail_statuses:
            logging.warning(
                "Twilio quality check failed sid=%s poll=%s status=%s duration=%s",
                call_sid,
                poll_count,
                call_status,
                duration_seconds,
            )
            return {
                "passed": False,
                "status": call_status,
                "technical_reason": f"Twilio reported {call_status}.",
            }

        if call_status not in pending_statuses and call_status:
            logging.info("Twilio quality check waiting on non-terminal status sid=%s status=%s", call_sid, call_status)

        await asyncio.sleep(1.2)

    logging.warning("Twilio quality check timed out sid=%s timeout_seconds=%s", call_sid, timeout_seconds)
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
                logging.info(
                    "Twilio inbound verification matched call sid=%s to=%s business_id=%s entry_id=%s",
                    matched_call.get("sid"),
                    matched_call.get("to"),
                    business_id,
                    entry_id,
                )
                maybe_auto_verify_business_forwarding(business, called_number=target_number)
                return

            await asyncio.sleep(4)
    except Exception as exc:
        logging.warning(
            "Failed while watching Twilio inbound verification for business %s entry %s: %s",
            business_id,
            entry_id,
            exc,
        )
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
        logging.warning("Failed to fetch recent Twilio calls for %s: %s", normalized_target, exc)
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
    logging.info(
        "Recent Twilio inbound call matched for auto-verification sid=%s to=%s business_id=%s",
        matched_call.get("sid"),
        matched_call.get("to"),
        business.get("id"),
    )
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
    source_number = normalize_phone_number(active_entry.get("source_number"))
    if not source_number:
        return None
    verified_caller_id = find_twilio_outgoing_caller_id(source_number)
    if not verified_caller_id:
        return None
    phone_number_id = ensure_elevenlabs_outbound_caller_id(
        source_number,
        active_entry.get("source_label") or business.get("name") or "Verified Caller ID",
    )
    now = datetime.now(timezone.utc).isoformat()
    numbers[active_index] = {
        **active_entry,
        "caller_id_verification_status": "verified",
        "caller_id_phone_number": source_number,
        "caller_id_outgoing_caller_id_sid": verified_caller_id.get("sid"),
        "caller_id_verified_at": active_entry.get("caller_id_verified_at") or now,
        "caller_id_validation_code": None,
        "caller_id_failure_reason": None,
        "caller_id_elevenlabs_phone_number_id": phone_number_id,
        "updated_at": now,
    }
    config["numbers"] = numbers
    persist_business_forwarding_config(business["id"], config)
    logging.info(
        "Twilio outgoing caller ID already verified; synced forwarding entry business_id=%s entry_id=%s source_number=%s",
        business.get("id"),
        active_entry.get("id"),
        source_number,
    )
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
        logging.warning("Failed to list ElevenLabs phone numbers: %s", exc)
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
        logging.info("Importing Twilio number into ElevenLabs phone_number=%s label=%s", phone_number, label)
        response = requests.post(
            "https://api.elevenlabs.io/v1/convai/phone-numbers",
            headers=headers,
            json=payload,
            timeout=60,
        )
        response.raise_for_status()
        phone_number_id = (response.json() or {}).get("phone_number_id")
        logging.info("Imported Twilio number into ElevenLabs phone_number=%s phone_number_id=%s", phone_number, phone_number_id)
        return phone_number_id
    except Exception as exc:
        logging.warning("Failed to import Twilio number into ElevenLabs: %s", exc)
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
        logging.info(
            "Assigning ElevenLabs phone number to inbound agent phone_number_id=%s inbound_agent_id=%s",
            phone_number_id,
            elevenlabs_agent_id_inbound,
        )
        response = requests.patch(
            f"https://api.elevenlabs.io/v1/convai/phone-numbers/{phone_number_id}",
            headers=headers,
            json={"agent_id": elevenlabs_agent_id_inbound},
            timeout=60,
        )
        response.raise_for_status()
        logging.info(
            "Assigned ElevenLabs phone number to inbound agent phone_number_id=%s inbound_agent_id=%s",
            phone_number_id,
            elevenlabs_agent_id_inbound,
        )
        return True
    except Exception as exc:
        logging.warning("Failed to assign ElevenLabs phone number %s to inbound agent: %s", phone_number_id, exc)
        return False


def ensure_elevenlabs_phone_number_for_business(business: dict) -> dict:
    phone_number = normalize_phone_number(business.get("twilio_number"))
    if not phone_number:
        return business

    label = business.get("name") or business.get("twilio_number_label") or f"Business {business.get('id')}"
    existing_phone = find_elevenlabs_phone_number(phone_number)
    phone_number_id = existing_phone.get("phone_number_id") if existing_phone else None
    logging.info(
        "Ensuring ElevenLabs phone number for business business_id=%s phone_number=%s existing_phone_number_id=%s",
        business.get("id"),
        phone_number,
        phone_number_id,
    )

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
        logging.warning("Failed to list Twilio incoming numbers for %s: %s", business.get("twilio_number"), list_response.text[:200])
        return business

    phone_numbers = (list_response.json() or {}).get("incoming_phone_numbers") or []
    if not phone_numbers:
        logging.warning("Assigned Twilio number %s was not found in account.", business.get("twilio_number"))
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
        logging.warning("Failed to configure Twilio webhook for %s: %s", business.get("twilio_number"), update_response.text[:200])
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
            detail=f"Twilio number search failed ({search_response.status_code}).",
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
            detail=f"Twilio number purchase failed ({purchase_response.status_code}): {detail[:200]}",
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
        return
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return
    loop.create_task(scenario_engine.handle_event(event_type, payload or {}))


push_live_event("FastAPI backend active on port 8000.", actor="system", severity="info", event_type="system_startup")


@app.on_event("startup")
async def startup_scenario_engine():
    global scenario_engine
    try:
        if scenario_engine:
            await scenario_engine.start()
    except Exception as exc:
        logging.error("Failed to start scenario engine: %s", exc, exc_info=True)


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
    limit: Optional[int] = 12


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
    logging.info("Scenario trigger fired: %s", json.dumps(trigger_payload, default=str))

    saved_event = trigger_payload
    persisted = False
    try:
        response = supabase.table("scenario_events").insert(trigger_payload).execute()
        saved_event = response.data[0] if getattr(response, "data", None) else trigger_payload
        persisted = True
    except Exception as exc:
        logging.warning("Scenario trigger persistence skipped: %s", exc)

    schedule_backend_scenario_execution(normalized_trigger_key, payload or {})
    return {"ok": True, "event": saved_event, "persisted": persisted}

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
        response = supabase.table("businesses").select("*").eq("user_id", str(user_id)).limit(1).execute()
        return hydrate_business_with_purchased_number_data(response.data[0]) if response.data else None
    except Exception:
        return None

def load_receptionist_by_id(receptionist_id: Optional[str]):
    if not receptionist_id:
        return None
    try:
        response = supabase.table("hired_receptionists").select("*").eq("id", str(receptionist_id)).limit(1).execute()
        return response.data[0] if response.data else None
    except Exception:
        return None

def find_business_by_forwarded_number(forwarded_number: Optional[str]):
    match_values = set(build_phone_match_values(forwarded_number))
    if not match_values:
        return None

    try:
        response = supabase.table("businesses").select("id,user_id,name,phone,forwarding_config").execute()
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
                .select("id,user_id,name,phone,forwarding_config")
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

    business_id = first_present(payload, "business_id", "businessId", "metadata.business_id")
    user_id = first_present(payload, "user_id", "userId", "metadata.user_id")
    receptionist_id = first_present(
        payload,
        "receptionist_id",
        "receptionistId",
        "hired_receptionist_id",
        "metadata.receptionist_id",
        "metadata.hired_receptionist_id",
    )
    receptionist_phone = first_present(payload, "receptionist_phone", "phone_number", "agent_phone_number", "to_number")
    forwarded_from = first_present(
        payload,
        "forwarded_from",
        "forwardedFrom",
        "ForwardedFrom",
        "metadata.forwarded_from",
        "source_number",
    )
    called_number = first_present(
        payload,
        "to_number",
        "To",
        "agent_phone_number",
        "phone_number",
        "metadata.to_number",
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
    if not business and receptionist_phone:
        try:
            response = supabase.table("hired_receptionists").select("*").eq("phone_number", str(receptionist_phone)).limit(1).execute()
            receptionist = receptionist or (response.data[0] if response.data else None)
            if receptionist:
                user_id = user_id or receptionist.get("user_id")
                business = load_business_by_id(receptionist.get("business_id")) or load_business_by_user_id(user_id)
        except Exception:
            pass

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
        "call_id": first_present(payload, "call_id", "CallSid", "callSid", "conversation_id"),
        "conversation_id": first_present(payload, "conversation_id", "ConversationSid"),
        "from_number": normalize_phone_number(first_present(payload, "from_number", "From", "caller_phone", "caller")),
        "to_number": normalize_phone_number(first_present(payload, "to_number", "To", "agent_phone_number", "phone_number")),
        "forwarded_from": normalize_phone_number(forwarded_from),
        "call_status": first_present(payload, "call_status", "CallStatus", "status"),
        "direction": first_present(payload, "direction", "Direction"),
        "provider": first_present(payload, "provider", "source") or "unknown",
        "received_at": datetime.now(timezone.utc).isoformat(),
        "path": request.url.path,
        "raw_payload": payload,
    }
    return call_payload

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
    direction_value = first_present(
        payload,
        "direction",
        "call.direction",
        "metadata.direction",
        "dynamic_variables.direction",
        "conversation_initiation_client_data.dynamic_variables.direction",
    )
    forwarded_from = first_present(
        payload,
        "forwarded_from",
        "forwardedFrom",
        "ForwardedFrom",
        "metadata.forwarded_from",
        "dynamic_variables.forwarded_from",
    )
    from_number = first_present(
        payload,
        "from_number",
        "caller.phone_number",
        "customer.phone_number",
        "metadata.from_number",
        "dynamic_variables.caller_number",
        "conversation_initiation_client_data.dynamic_variables.caller_number",
    )
    to_number = first_present(
        payload,
        "to_number",
        "agent_phone_number",
        "phone_number",
        "metadata.to_number",
        "metadata.twilio_to_number",
        "dynamic_variables.twilio_to_number",
        "conversation_initiation_client_data.dynamic_variables.twilio_to_number",
    )
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

    normalized_direction = str(direction_value or "").strip().lower() or None
    normalized_to_number = normalize_phone_number(to_number)
    normalized_from_number = normalize_phone_number(from_number)
    normalized_forwarded_from = normalize_phone_number(forwarded_from)

    return {
        "source": "elevenlabs",
        "external_call_id": str(call_id) if call_id else None,
        "conversation_id": str(conversation_id) if conversation_id else None,
        "elevenlabs_agent_id": str(elevenlabs_agent_id) if elevenlabs_agent_id else None,
        "hired_receptionist_id": receptionist.get("id") if receptionist else (str(hired_receptionist_id) if hired_receptionist_id else None),
        "user_id": receptionist.get("user_id") if receptionist else None,
        "receptionist_name": receptionist.get("full_name") if receptionist else None,
        "scenario_id": str(scenario_id) if scenario_id else None,
        "direction": normalized_direction,
        "from_number": normalized_from_number,
        "to_number": normalized_to_number or (normalize_phone_number(receptionist.get("phone_number")) if receptionist else None),
        "forwarded_from": normalized_forwarded_from,
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

@app.post("/api/scenarios/trigger", tags=["Scenarios"])
async def trigger_scenario(request: ScenarioTriggerRequest):
    return emit_scenario_trigger(request.trigger_key, request.payload, request.created_at)

@app.post("/api/trigger-scenario", tags=["Scenarios"])
async def trigger_scenario_legacy_alias(request: ScenarioTriggerRequest):
    return emit_scenario_trigger(request.trigger_key, request.payload, request.created_at)

@app.post("/api/scenarios/trigger/{scenario_id}", tags=["Scenarios"])
async def trigger_specific_scenario(scenario_id: str, payload: dict):
    if not scenario_engine:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Scenario engine unavailable")
    result = await scenario_engine.trigger_scenario(scenario_id, payload)
    if not result.get("ok"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=result.get("error") or "Scenario not found")
    return result

@app.post("/api/scenarios/resume", tags=["Scenarios"])
async def resume_scenario_execution(payload: dict):
    if not scenario_engine:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Scenario engine unavailable")
    execution_id = payload.get("execution_id")
    if not execution_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="execution_id required")
    resume_payload = {
        "agent": payload.get("agent_data") or payload.get("agent") or {},
        "call": {
            "call_sid": payload.get("call_sid"),
            "call_outcome": payload.get("call_outcome"),
        },
    }
    result = await scenario_engine.resume_execution(execution_id, resume_payload)
    if result.get("success"):
        return {"ok": True, **result}
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=result.get("error") or "Resume failed")

@app.get("/api/scenarios/executions", tags=["Scenarios"])
async def list_scenario_executions(limit: int = 20):
    if not scenario_engine:
        return []
    return await scenario_engine.list_executions(max(1, min(limit, 100)))

@app.get("/api/scenarios/executions/{execution_id}", tags=["Scenarios"])
async def get_scenario_execution(execution_id: str):
    if not scenario_engine:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Scenario engine unavailable")
    execution = await scenario_engine.get_execution(execution_id)
    if not execution:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Execution not found")
    return execution

@app.post("/api/scenarios/reload", tags=["Scenarios"])
async def reload_scenarios():
    if not scenario_engine:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Scenario engine unavailable")
    scenarios = await scenario_engine.load_scenarios()
    return {"ok": True, "count": len(scenarios)}

@app.post("/twilio/inbound", tags=["Twilio"])
async def twilio_inbound_webhook(request: Request):
    payload = await parse_request_payload(request)
    from_number = normalize_phone_number(first_present(payload, "From", "from", "from_number", "Caller", "caller"))
    to_number = normalize_phone_number(first_present(payload, "To", "to", "to_number", "Called", "called"))

    if not elevenlabs_api_key or not elevenlabs_agent_id_inbound:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ElevenLabs inbound calling is not configured.",
        )
    if not from_number or not to_number:
        logging.error(
            "Twilio inbound webhook missing From/To. content_type=%s payload=%s",
            request.headers.get("content-type"),
            json.dumps(payload, default=str),
        )
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
    }
    emit_scenario_trigger("incoming_call", event_payload)

    register_payload = {
        "agent_id": elevenlabs_agent_id_inbound,
        "from_number": from_number,
        "to_number": to_number,
        "direction": "inbound",
        "conversation_initiation_client_data": {
            "dynamic_variables": {
                "caller_number": from_number,
                "business_id": str(business.get("id")) if business and business.get("id") is not None else None,
                "business_name": business.get("name") if business else None,
                "twilio_to_number": to_number,
                "twilio_call_sid": first_present(payload, "CallSid"),
            }
        },
    }
    register_payload["conversation_initiation_client_data"]["dynamic_variables"] = {
        key: value
        for key, value in register_payload["conversation_initiation_client_data"]["dynamic_variables"].items()
        if value is not None
    }

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
        logging.error("ElevenLabs register-call failed: %s %s", response.status_code, response.text[:400])
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"ElevenLabs register-call failed ({response.status_code}).",
        )

    return Response(content=response.text, media_type="application/xml")

@app.post("/api/call/route", tags=["Server Tools"])
async def route_call_compat(request: Request):
    payload = await parse_request_payload(request)
    call_payload = build_call_route_payload(payload, request)
    context = resolve_business_context(call_payload)
    maybe_auto_verify_business_forwarding(
        context.get("business"),
        called_number=call_payload.get("to_number"),
    )

    event_payload = {
        **call_payload,
        "user_id": context.get("user_id"),
        "business_id": context.get("business", {}).get("id") if context.get("business") else None,
        "business_name": context.get("business", {}).get("name") if context.get("business") else None,
        "forwarding_target_number": get_business_forwarding_target_number(context.get("business")),
    }

    event = emit_scenario_trigger(call_payload["trigger_key"], event_payload)
    push_live_event(
        f"Call route trigger received ({call_payload['trigger_key']}).",
        actor="system",
        severity="info",
        event_type="call_route",
        payload=event_payload,
    )

    return {
        "ok": True,
        "message": "FastAPI call route compatibility endpoint handled the request.",
        "route": event_payload,
        "event": event.get("event"),
    }

@app.post("/api/tools/report-intent-checkpoint", tags=["Server Tools"])
async def report_intent_checkpoint(request: IntentCheckpointRequest):
    return emit_intent_checkpoint(request)

@app.api_route("/api/tools/{tool_name}", methods=["GET", "POST"], tags=["Server Tools"])
async def legacy_server_tool(tool_name: str, request: Request):
    payload = await parse_request_payload(request)
    context = resolve_business_context(payload)
    business = context.get("business")
    user_id = context.get("user_id")
    receptionist = context.get("receptionist")

    normalized_tool = (tool_name or "").strip().lower().replace("_", "-")

    if normalized_tool in {"identify-caller", "lookup-customer"}:
        search_phone = normalize_phone_number(first_present(payload, "phone", "from_number", "caller_phone", "From"))
        search_email = first_present(payload, "email", "caller_email")
        search_name = str(first_present(payload, "name", "full_name", "customer_name") or "").strip().lower()

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

    if normalized_tool == "get-business-info":
        if not business:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business context not found")
        return {
            "ok": True,
            "business": serialize_business_profile_row(business),
            "forwarding_target_number": get_business_forwarding_target_number(business),
        }

    if normalized_tool == "check-availability":
        appointment_date = first_present(payload, "date", "appointment_date")
        appointment_time = first_present(payload, "time", "appointment_time")
        query = supabase.table("appointments").select("*")
        if business and business.get("id"):
            try:
                query = query.eq("business_id", business["id"])
            except Exception:
                pass
        if appointment_date:
            query = query.eq("date", appointment_date)
        rows = query.limit(200).execute().data or []
        conflicts = [
            row for row in rows
            if appointment_time and str(row.get("time") or "") == str(appointment_time)
            and str(row.get("status") or "").lower() not in {"cancelled", "completed"}
        ]
        return {
            "ok": True,
            "available": len(conflicts) == 0,
            "requested": {"date": appointment_date, "time": appointment_time},
            "conflicts": conflicts,
        }

    if normalized_tool == "create-appointment":
        appointment_row = {
            "client_name": first_present(payload, "client_name", "name", "customer_name"),
            "date": first_present(payload, "date", "appointment_date"),
            "time": first_present(payload, "time", "appointment_time"),
            "duration": first_present(payload, "duration", "appointment_duration") or 30,
            "status": first_present(payload, "status") or "pending",
            "assigned_receptionist": first_present(payload, "assigned_receptionist", "receptionist_name") or (receptionist or {}).get("full_name"),
            "notes": first_present(payload, "notes"),
            "person_id": first_present(payload, "person_id"),
            "service_id": first_present(payload, "service_id"),
            "business_id": business.get("id") if business else None,
        }
        response = supabase.table("appointments").insert(appointment_row).execute()
        created = response.data[0] if response.data else appointment_row
        emit_scenario_trigger("appointment_created", {"appointment": created, "business_id": business.get("id") if business else None})
        return {"ok": True, "appointment": created}

    if normalized_tool == "update-appointment":
        appointment_id = first_present(payload, "appointment_id", "id")
        if not appointment_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="appointment_id is required")
        updates = {
            key: value for key, value in {
                "client_name": first_present(payload, "client_name", "name", "customer_name"),
                "date": first_present(payload, "date", "appointment_date"),
                "time": first_present(payload, "time", "appointment_time"),
                "duration": first_present(payload, "duration", "appointment_duration"),
                "status": first_present(payload, "status"),
                "assigned_receptionist": first_present(payload, "assigned_receptionist", "receptionist_name"),
                "notes": first_present(payload, "notes"),
                "person_id": first_present(payload, "person_id"),
                "service_id": first_present(payload, "service_id"),
            }.items() if value is not None
        }
        response = supabase.table("appointments").update(updates).eq("id", appointment_id).execute()
        updated = response.data[0] if response.data else {"id": appointment_id, **updates}
        emit_scenario_trigger("appointment_updated", {"appointment": updated, "business_id": business.get("id") if business else None})
        return {"ok": True, "appointment": updated}

    if normalized_tool == "cancel-appointment":
        appointment_id = first_present(payload, "appointment_id", "id")
        if not appointment_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="appointment_id is required")
        response = supabase.table("appointments").update({"status": "cancelled"}).eq("id", appointment_id).execute()
        cancelled = response.data[0] if response.data else {"id": appointment_id, "status": "cancelled"}
        emit_scenario_trigger("appointment_cancelled", {"appointment": cancelled, "business_id": business.get("id") if business else None})
        return {"ok": True, "appointment": cancelled}

    if normalized_tool == "log-call-outcome":
        call_log = {
            "source": "server_tool",
            "external_call_id": first_present(payload, "call_id", "CallSid", "callSid"),
            "conversation_id": first_present(payload, "conversation_id"),
            "elevenlabs_agent_id": first_present(payload, "agent_id", "elevenlabs_agent_id"),
            "hired_receptionist_id": (receptionist or {}).get("id") or first_present(payload, "hired_receptionist_id", "receptionist_id"),
            "user_id": user_id,
            "receptionist_name": (receptionist or {}).get("full_name") or first_present(payload, "receptionist_name"),
            "scenario_id": first_present(payload, "scenario_id"),
            "from_number": normalize_phone_number(first_present(payload, "from_number", "From", "caller_phone")),
            "to_number": normalize_phone_number(first_present(payload, "to_number", "To", "phone_number")) or get_business_forwarding_target_number(business),
            "started_at": first_present(payload, "started_at"),
            "ended_at": first_present(payload, "ended_at"),
            "duration_seconds": first_present(payload, "duration_seconds", "duration"),
            "status": first_present(payload, "status", "call_status"),
            "outcome": first_present(payload, "outcome"),
            "summary": first_present(payload, "summary"),
            "transcript_text": first_present(payload, "transcript", "transcript_text"),
            "sentiment": first_present(payload, "sentiment"),
            "raw_payload": payload,
        }
        response = supabase.table("call_logs").insert(call_log).execute()
        saved = response.data[0] if response.data else call_log
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
        return {"ok": True, "status": "queued", "transfer": transfer_payload}

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Unknown server tool: {tool_name}")

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
    business_context = resolve_business_context({
        "user_id": call_log.get("user_id"),
        "to_number": call_log.get("to_number"),
        "forwarded_from": call_log.get("forwarded_from"),
    })
    verification_called_number = call_log.get("to_number")
    if not verification_called_number and str(call_log.get("direction") or "").lower() == "inbound":
        verification_called_number = ((business_context.get("business") or {}).get("twilio_number"))
        if verification_called_number:
            logging.info(
                "ElevenLabs post-call webhook inferred inbound assigned number for verification: %s",
                verification_called_number,
            )
    maybe_auto_verify_business_forwarding(
        business_context.get("business"),
        called_number=verification_called_number,
    )

    try:
        response = supabase.table("call_logs").insert(call_log).execute()
    except Exception as exc:
        logging.error("Failed to persist call log: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to persist call log",
        ) from exc

    saved = response.data[0] if getattr(response, "data", None) else call_log

    flow_execution_id = first_present(
        payload,
        "flow_execution_id",
        "metadata.flow_execution_id",
        "dynamic_variables.flow_execution_id",
    )
    agent_data = (
        deep_get(payload, "agent_data")
        or deep_get(payload, "analysis.data_collection_results")
        or deep_get(payload, "analysis.extracted_variables")
        or {}
    )
    if flow_execution_id and scenario_engine:
        try:
            await scenario_engine.resume_execution(
                str(flow_execution_id),
                {
                    "agent": agent_data if isinstance(agent_data, dict) else {},
                    "call": {
                        "call_sid": call_log.get("external_call_id"),
                        "call_outcome": call_log.get("outcome"),
                    },
                },
            )
        except Exception as exc:
            logging.error("Failed to resume scenario execution %s: %s", flow_execution_id, exc, exc_info=True)

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
                "status": row.get("status") or "Offline",
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
    existing_response = supabase.table('hired_receptionists').select('id,status').eq('id', agent_id).limit(1).execute()
    existing_agent = (existing_response.data or [{}])[0]
    next_status = derive_receptionist_status(payload.call_types, existing_agent.get('status'))
    response = supabase.table('hired_receptionists').update({
        'call_types': payload.call_types,
        'status': next_status,
    }).eq('id', agent_id).execute()
    push_live_event("Agent call handling updated.", actor="system", severity="info", event_type="agent_updated", payload={"agent_id": agent_id, "call_types": payload.call_types})
    return response.data[0] if response.data else {"id": agent_id, "call_types": payload.call_types, "status": next_status}

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

@app.get("/api/sonar/business/profile", tags=["Sonar Business"])
async def get_sonar_business_profile(current_user: dict = Depends(get_current_user)):
    business = load_business_by_user_id(str(current_user.id))
    if not business:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    return serialize_business_profile_row(business)

@app.put("/api/sonar/business/profile", tags=["Sonar Business"])
async def update_sonar_business_profile(payload: dict, current_user: dict = Depends(get_current_user)):
    business = load_business_by_user_id(str(current_user.id))
    if not business:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")

    allowed_fields = {
        "name", "phone", "email", "address", "city", "state", "zip", "website",
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

@app.get("/api/sonar/people", tags=["Sonar People"])
async def list_sonar_people(limit: int = 100, current_user: dict = Depends(get_current_user)):
    business = load_business_by_user_id(str(current_user.id))
    query = supabase.table("people").select("*")
    if business:
        query = query.eq("business_id", business["id"])
    else:
        query = query.eq("user_id", str(current_user.id))
    response = query.order("created_at", desc=True).limit(max(1, min(limit, 500))).execute()
    return response.data or []

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
    business = load_business_by_user_id(str(current_user.id))
    query = supabase.table("people").select("*").eq("id", person_id)
    if business:
        query = query.eq("business_id", business["id"])
    else:
        query = query.eq("user_id", str(current_user.id))
    response = query.limit(1).execute()
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")
    return response.data[0]

@app.post("/api/sonar/people", tags=["Sonar People"])
async def create_sonar_person(payload: dict, current_user: dict = Depends(get_current_user)):
    business = load_business_by_user_id(str(current_user.id))
    insert_payload = {**payload}
    insert_payload["user_id"] = insert_payload.get("user_id") or str(current_user.id)
    if business and "business_id" not in insert_payload:
        insert_payload["business_id"] = business["id"]
    response = supabase.table("people").insert(insert_payload).execute()
    created = response.data[0] if response.data else insert_payload
    schedule_backend_scenario_execution("record_created", {
        "record_id": created.get("id"),
        "person_id": created.get("id"),
        "user_id": created.get("user_id") or str(current_user.id),
        "business_id": created.get("business_id") or (business or {}).get("id"),
        "person": created,
        "record": created,
    })
    return created

@app.put("/api/sonar/people/{person_id}", tags=["Sonar People"])
async def update_sonar_person(person_id: str, payload: dict, current_user: dict = Depends(get_current_user)):
    business = load_business_by_user_id(str(current_user.id))
    existing_query = supabase.table("people").select("*").eq("id", person_id)
    if business:
        existing_query = existing_query.eq("business_id", business["id"])
    else:
        existing_query = existing_query.eq("user_id", str(current_user.id))
    existing_response = existing_query.limit(1).execute()
    if not existing_response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")

    updates = {key: value for key, value in payload.items() if key not in {"id", "user_id", "business_id", "created_at"}}
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    response = supabase.table("people").update(updates).eq("id", person_id).execute()
    updated = response.data[0] if response.data else {**existing_response.data[0], **updates}
    schedule_backend_scenario_execution("record_updated", {
        "record_id": updated.get("id") or person_id,
        "person_id": updated.get("id") or person_id,
        "user_id": updated.get("user_id") or existing_response.data[0].get("user_id") or str(current_user.id),
        "business_id": updated.get("business_id") or existing_response.data[0].get("business_id") or (business or {}).get("id"),
        "person": updated,
        "record": updated,
    })
    return updated

@app.delete("/api/sonar/people/{person_id}", tags=["Sonar People"])
async def delete_sonar_person(person_id: str, current_user: dict = Depends(get_current_user)):
    business = load_business_by_user_id(str(current_user.id))
    existing_query = supabase.table("people").select("id").eq("id", person_id)
    if business:
        existing_query = existing_query.eq("business_id", business["id"])
    else:
        existing_query = existing_query.eq("user_id", str(current_user.id))
    existing_response = existing_query.limit(1).execute()
    if not existing_response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")

    deleted = existing_response.data[0]
    supabase.table("people").delete().eq("id", person_id).execute()
    schedule_backend_scenario_execution("record_deleted", {
        "record_id": person_id,
        "person_id": person_id,
        "user_id": deleted.get("user_id") or str(current_user.id),
        "business_id": deleted.get("business_id") or (business or {}).get("id"),
        "person": deleted,
        "record": deleted,
    })
    return {"ok": True, "id": person_id}

@app.get("/api/sonar/services", tags=["Sonar Services"])
async def list_sonar_services(current_user: dict = Depends(get_current_user)):
    business = load_business_by_user_id(str(current_user.id))
    query = supabase.table("services").select("*")
    if business:
        try:
            query = query.eq("business_id", business["id"])
        except Exception:
            pass
    response = query.order("category").order("sort_order").execute()
    return response.data or []

@app.post("/api/sonar/services", tags=["Sonar Services"])
async def create_sonar_service(payload: dict, current_user: dict = Depends(get_current_user)):
    business = load_business_by_user_id(str(current_user.id))
    insert_payload = {**payload}
    if business and "business_id" not in insert_payload:
        insert_payload["business_id"] = business["id"]
    response = supabase.table("services").insert(insert_payload).execute()
    return response.data[0] if response.data else insert_payload

@app.get("/api/sonar/appointments", tags=["Sonar Appointments"])
async def list_sonar_appointments(limit: int = 100, current_user: dict = Depends(get_current_user)):
    business = load_business_by_user_id(str(current_user.id))
    query = supabase.table("appointments").select("*")
    if business:
        try:
            query = query.eq("business_id", business["id"])
        except Exception:
            pass
    response = query.order("date").order("time").limit(max(1, min(limit, 500))).execute()
    return response.data or []

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
        .eq("user_id", str(current_user.id))
        .order("hired_at", desc=True)
        .execute()
    )
    return response.data or []

@app.get("/api/sonar/receptionists/catalog", tags=["Sonar Receptionists"])
async def list_receptionist_catalog():
    response = (
        supabase.table("receptionist_catalog")
        .select("*")
        .eq("is_active", True)
        .order("full_name")
        .execute()
    )
    return response.data or []

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


async def scenario_create_payment_callback(payload: dict):
    request = PaymentCreateRequest(**payload)
    return await create_payment(request)


async def scenario_create_payment_profile_callback(payload: dict):
    request = PaymentProfileCreateRequest(**payload)
    return await create_payment_profile(request)


async def scenario_create_invoice_callback(payload: dict):
    request = InvoiceCreateRequest(**payload)
    return await create_invoice(request)


async def scenario_send_invoice_callback(payload: dict):
    request = InvoiceSendRequest(**payload)
    return await send_invoice(request)


scenario_engine = ScenarioEngine(
    supabase=supabase,
    callbacks={
        "create_payment": scenario_create_payment_callback,
        "create_payment_profile": scenario_create_payment_profile_callback,
        "create_invoice": scenario_create_invoice_callback,
        "send_invoice": scenario_send_invoice_callback,
    },
    base_url=os.environ.get("SCENARIO_ENGINE_BASE_URL", "http://127.0.0.1:8000"),
)

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
        logging.error(f"Failed to load forwarding config for user {current_user_id}: {e}", exc_info=True)
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
    limit: int = 12,
    current_user: dict = Depends(get_current_user),
):
    current_user_id = str(current_user.id)

    try:
        business = get_business_record_for_user(current_user_id)
        purchase_limit = get_system_number_purchase_limit()
        purchase_count = get_business_number_purchase_count(business)

        filters = {
            "area_code": area_code or extract_us_area_code(business.get("phone")),
            "contains": contains or None,
            "near_number": near_number or normalize_phone_number(business.get("phone")),
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
        logging.error("Failed to search forwarding numbers for user %s: %s", current_user_id, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load available phone numbers.",
        )


@app.post("/businesses/me/forwarding/claim-number", tags=["Businesses"])
async def claim_business_forwarding_number(
    payload: BusinessForwardingNumberClaimRequest,
    current_user: dict = Depends(get_current_user),
):
    current_user_id = str(current_user.id)

    try:
        business = get_business_record_for_user(current_user_id)
        logging.info(
            "Claim forwarding number requested user_id=%s business_id=%s requested_number=%s current_active_number=%s",
            current_user_id,
            business.get("id"),
            normalize_phone_number(payload.phone_number),
            business.get("twilio_number"),
        )
        updated_business, purchased, purchased_row = purchase_specific_twilio_number_for_business(
            business,
            payload.phone_number,
            payload.label or business.get("name") or "Dedicated forwarding line",
        )
        logging.info(
            "Forwarding number purchased and saved business_id=%s purchased_number=%s purchased_row_id=%s incoming_sid=%s",
            business.get("id"),
            purchased.get("phone_number"),
            purchased_row.get("id") if isinstance(purchased_row, dict) else None,
            purchased.get("sid"),
        )

        elevenlabs_business = ensure_elevenlabs_phone_number_for_business(updated_business)
        phone_number_id = elevenlabs_business.get("elevenlabs_phone_number_id") or find_elevenlabs_phone_number(
            elevenlabs_business.get("twilio_number")
        )
        if isinstance(phone_number_id, dict):
            phone_number_id = phone_number_id.get("phone_number_id")

        if not phone_number_id:
            logging.warning(
                "Forwarding number setup failed before quality test business_id=%s purchased_number=%s incoming_sid=%s reason=missing_elevenlabs_phone_number_id",
                business.get("id"),
                purchased.get("phone_number"),
                purchased.get("sid"),
            )
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
        logging.info(
            "Forwarding number quality test started business_id=%s purchased_number=%s phone_number_id=%s call_sid=%s",
            business.get("id"),
            purchased.get("phone_number"),
            phone_number_id,
            test_call.get("callSid") or test_call.get("call_sid"),
        )
        quality_result = await wait_for_twilio_quality_test_result(
            test_call.get("callSid") or test_call.get("call_sid")
        )
        logging.info(
            "Forwarding number quality test completed business_id=%s purchased_number=%s phone_number_id=%s passed=%s status=%s technical_reason=%s",
            business.get("id"),
            purchased.get("phone_number"),
            phone_number_id,
            quality_result.get("passed"),
            quality_result.get("status"),
            quality_result.get("technical_reason"),
        )

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
            logging.warning(
                "Forwarding number quality test failed and cleaned up business_id=%s purchased_number=%s incoming_sid=%s phone_number_id=%s message=%s technical_reason=%s",
                business.get("id"),
                purchased.get("phone_number"),
                purchased.get("sid"),
                phone_number_id,
                failure_message,
                quality_result.get("technical_reason"),
            )

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
        activated_business = hydrate_business_with_purchased_number_data(business) or business
        logging.info(
            "Forwarding number activated business_id=%s active_number=%s incoming_sid=%s phone_number_id=%s activated_row_id=%s",
            business.get("id"),
            activated_business.get("twilio_number"),
            purchased.get("sid"),
            phone_number_id,
            activated_row.get("id") if isinstance(activated_row, dict) else None,
        )

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
        logging.error("Failed to claim forwarding number for user %s: %s", current_user_id, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to set up that phone number.",
        )


@app.post("/businesses/me/forwarding/caller-id/start", tags=["Businesses"])
async def start_business_forwarding_caller_id_verification(
    payload: BusinessCallerIdVerificationStartRequest,
    current_user: dict = Depends(get_current_user),
):
    current_user_id = str(current_user.id)

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
        logging.error("Failed to start caller ID verification for user %s: %s", current_user_id, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to start caller ID verification.",
        )


@app.post("/twilio/outgoing-caller-id/status", tags=["Twilio"])
async def twilio_outgoing_caller_id_status(request: Request):
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
        logging.error("Failed to load businesses for caller ID status callback: %s", exc, exc_info=True)
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
                .select('id,call_types,status')
                .eq('id', payload.agent_id)
                .eq('user_id', current_user_id)
                .limit(1)
                .execute()
            )
            agent_row = (agent_lookup.data or [None])[0]
            if agent_row:
                next_agent_status = derive_receptionist_status(
                    agent_row.get('call_types'),
                    agent_row.get('status'),
                    preserve_offline=False,
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
