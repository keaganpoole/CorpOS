"""Consent-gated Phase 1 collection. No visitor reads are exposed to browsers.

Mount build_visitor_router(supabase_admin, get_current_user) and exempt its three
exact POST paths from business-membership middleware. RPCs require service_role;
only this dedicated adapter bypasses ScopedClient's tenant-RPC restriction.
SQL owns atomic proof checks, revocation, event/session deduplication and linking.
Production defaults on (NODEMERE_ENV=production or RENDER); local defaults off.
VISITOR_TRACKING_ENABLED overrides collection, never signed consent revocation.
"""
from collections import OrderedDict
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import json
import logging
import math
import os
import re
from threading import Lock
import time
from types import SimpleNamespace
from typing import Annotated, Literal
from urllib.parse import urlsplit
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator
from starlette.concurrency import run_in_threadpool

CONSENT_VERSION = "2026-09-05"
MAX_BODY_BYTES = 32 * 1024
PUBLIC_PATHS = frozenset({
    "/", "/pricing", "/auth", "/privacy-policy", "/terms", "/acceptable-use-policy",
    "/communications-notice", "/data-processing-addendum", "/subprocessors", "/cookie-notice",
})
PRODUCTION_ORIGINS = frozenset({"https://nodemere.ai", "https://www.nodemere.ai", "https://nodemere.io", "https://www.nodemere.io"})
EVENT_NAMES = frozenset({
    "session_start", "session_end", "page_view", "page_leave", "cta_click", "navigation_click",
    "homepage_click", "section_view", "section_attention", "section_progression",
    "scroll_25", "scroll_50", "scroll_75", "scroll_90", "scroll_100", "engagement",
    "form_started", "field_focused", "form_completed", "signup_started", "checkout_started",
})
HOMEPAGE_SECTIONS = {
    "hero": 0, "calendar": 1, "people-crm": 2, "live-monitoring": 3,
    "comparison": 4, "scenarios": 5, "security": 6,
}
Slug = Annotated[str, Field(max_length=80, pattern=r"^[A-Za-z][A-Za-z0-9_-]{0,79}$")]
Campaign = Annotated[str, Field(max_length=100, pattern=r"^[A-Za-z0-9][A-Za-z0-9._~-]{0,99}$")]
Version = Annotated[str, Field(max_length=24, pattern=r"^[0-9]{1,4}(?:\.[0-9]{1,4}){0,3}$")]
Language = Annotated[str, Field(max_length=35, pattern=r"^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8}){0,3}$")]
Dimension = Annotated[int, Field(ge=0, le=16384)]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False)


class Consent(StrictModel):
    analytics: Literal[True]
    version: Literal["2026-09-05"]
    updated_at: AwareDatetime

    @field_validator("analytics", mode="before")
    @classmethod
    def explicit_boolean(cls, value):
        if value is not True:
            raise ValueError("Explicit analytics consent required")
        return value


def public_path(value):
    """Return only a known static path, discarding all URL query/fragment data."""
    if not isinstance(value, str) or len(value) > 2048 or "\\" in value:
        return None
    if any(ord(c) < 32 or ord(c) == 127 for c in value):
        return None
    try:
        parts = urlsplit(value)
        if parts.scheme or parts.netloc or not value.startswith("/") or value.startswith("//"):
            return None
        return parts.path if parts.path in PUBLIC_PATHS else None
    except ValueError:
        return None


class Attribution(StrictModel):
    landing_page: str | None = Field(default=None, max_length=2048)
    referrer: str | None = Field(default=None, max_length=2048)
    utm_source: Campaign | None = None
    utm_medium: Campaign | None = None
    utm_campaign: Campaign | None = None
    utm_term: Campaign | None = None
    utm_content: Campaign | None = None

    @field_validator("landing_page")
    @classmethod
    def clean_landing(cls, value):
        return public_path(value)

    @field_validator("referrer")
    @classmethod
    def clean_referrer(cls, value):
        if not value or "\\" in value or any(ord(c) < 32 for c in value):
            return None
        try:
            parts = urlsplit(value)
            host = parts.hostname
            if (parts.scheme not in {"http", "https"} or not host or parts.username or parts.password
                    or not re.fullmatch(r"[a-zA-Z0-9.-]{1,253}", host)):
                return None
            # Paths, credentials, query parameters and fragments never persist.
            return parts.scheme + "://" + host.lower()
        except ValueError:
            return None


class Device(StrictModel):
    browser: Literal["chrome", "edge", "firefox", "safari", "opera", "samsung_internet", "other", "unknown"] | None = None
    browser_version: Version | None = None
    os: Literal["windows", "macos", "ios", "android", "linux", "chromeos", "other", "unknown"] | None = None
    os_version: Version | None = None
    device_type: Literal["desktop", "mobile", "tablet", "unknown"] | None = None
    screen_width: Dimension | None = None
    screen_height: Dimension | None = None
    viewport_width: Dimension | None = None
    viewport_height: Dimension | None = None
    pixel_ratio: Annotated[float, Field(gt=0, le=8)] | None = None
    timezone: Annotated[str, Field(max_length=64, pattern=r"^(?:UTC|GMT|[A-Za-z_+-]+/[A-Za-z0-9_+-]+(?:/[A-Za-z0-9_+-]+)?)$")] | None = None
    language: Language | None = None
    locale: Language | None = None
    touch_support: bool | None = None


class Metadata(StrictModel):
    element_id: Slug | None = None
    element_type: Literal["button", "link", "form", "input", "select", "textarea", "section", "other"] | None = None
    section_id: Slug | None = None
    section_index: Annotated[int, Field(ge=-1, le=63)] | None = None
    from_section_id: Slug | None = None
    from_section_index: Annotated[int, Field(ge=0, le=63)] | None = None
    to_section_id: Slug | None = None
    to_section_index: Annotated[int, Field(ge=0, le=63)] | None = None
    deepest_section_id: Slug | None = None
    deepest_section_index: Annotated[int, Field(ge=0, le=63)] | None = None
    href: str | None = Field(default=None, max_length=2048)
    device_class: Literal["desktop", "mobile", "tablet", "unknown"] | None = None
    engaged_seconds: Annotated[float, Field(ge=0, le=60)] | None = None
    scroll_depth: Annotated[float, Field(ge=0, le=100)] | None = None
    normalized_x: Annotated[float, Field(ge=0, le=1)] | None = None
    normalized_y: Annotated[float, Field(ge=0, le=1)] | None = None
    viewport_width: Dimension | None = None
    viewport_height: Dimension | None = None
    visible_seconds: Annotated[float, Field(ge=0, le=86400)] | None = None
    continued: bool | None = None
    form_id: Slug | None = None
    field_id: Slug | None = None

    @field_validator("href")
    @classmethod
    def clean_href(cls, value):
        return public_path(value)


class Event(StrictModel):
    id: UUID
    name: str
    occurred_at: AwareDatetime
    page: str
    metadata: Metadata = Field(default_factory=Metadata)

    @field_validator("name")
    @classmethod
    def known_event(cls, value):
        if value not in EVENT_NAMES:
            raise ValueError("Unknown event")
        return value

    @field_validator("page")
    @classmethod
    def known_page(cls, value):
        if value not in PUBLIC_PATHS:
            raise ValueError("Unknown public page")
        return value

    @model_validator(mode="after")
    def homepage_contract(self):
        metadata = self.metadata
        phase_two = {"homepage_click", "section_view", "section_attention", "section_progression"}
        if self.name in phase_two and self.page != "/":
            raise ValueError("Homepage intelligence events are homepage-only")
        if self.name in {"homepage_click", "section_view", "section_attention"}:
            allowed_sections = {**HOMEPAGE_SECTIONS, "header": -1} if self.name == "homepage_click" else HOMEPAGE_SECTIONS
            if allowed_sections.get(metadata.section_id) != metadata.section_index:
                raise ValueError("Unknown homepage section")
            if not metadata.device_class or not metadata.viewport_width or not metadata.viewport_height:
                raise ValueError("Homepage device and viewport required")
        if self.name == "homepage_click":
            if metadata.normalized_x is None or metadata.normalized_y is None or not metadata.element_id or not metadata.element_type:
                raise ValueError("Normalized click identity required")
        if self.name == "section_attention":
            if metadata.visible_seconds is None or metadata.visible_seconds < 1 or metadata.continued is None:
                raise ValueError("Qualified attention required")
            if HOMEPAGE_SECTIONS.get(metadata.deepest_section_id) != metadata.deepest_section_index:
                raise ValueError("Unknown deepest section")
            if metadata.deepest_section_index < metadata.section_index or metadata.continued != (metadata.deepest_section_index > metadata.section_index):
                raise ValueError("Invalid continuation")
        if self.name == "section_progression":
            if (HOMEPAGE_SECTIONS.get(metadata.from_section_id) != metadata.from_section_index
                    or HOMEPAGE_SECTIONS.get(metadata.to_section_id) != metadata.to_section_index
                    or metadata.from_section_id == metadata.to_section_id
                    or not metadata.device_class or not metadata.viewport_width or not metadata.viewport_height):
                raise ValueError("Invalid homepage progression")
        if self.page == "/" and self.name in {"cta_click", "navigation_click"} and metadata.section_id is not None:
            allowed_sections = {**HOMEPAGE_SECTIONS, "header": -1}
            if (allowed_sections.get(metadata.section_id) != metadata.section_index
                    or metadata.normalized_x is None or metadata.normalized_y is None
                    or not metadata.element_id or not metadata.element_type or not metadata.device_class
                    or not metadata.viewport_width or not metadata.viewport_height):
                raise ValueError("Unknown homepage click section")
        return self


class CollectInput(StrictModel):
    visitor_id: UUID
    visitor_token: str | None = Field(default=None, max_length=160)
    session_id: UUID
    consent: Consent
    attribution: Attribution
    device: Device
    events: list[Event] = Field(min_length=1, max_length=40)


class IdentityInput(StrictModel):
    visitor_id: UUID
    visitor_token: str = Field(min_length=1, max_length=160)
    consent: Consent


class RevokeInput(StrictModel):
    visitor_id: UUID
    visitor_token: str = Field(min_length=1, max_length=160)


def enabled(name="VISITOR_TRACKING_ENABLED"):
    value = os.getenv(name)
    if value is None and name == "VISITOR_TRACKING_ENABLED":
        return os.getenv("NODEMERE_ENV", "").lower() == "production" or bool(os.getenv("RENDER"))
    return (value or "").strip().lower() in {"1", "true", "yes", "on"}


def failure(status, code):
    return HTTPException(status, {"code": code})


def signing_key():
    explicit = os.getenv("VISITOR_SIGNING_SECRET")
    fallback = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if explicit:
        if len(explicit.encode()) < 32:
            raise failure(503, "visitor_unavailable")
        return hmac.digest(explicit.encode(), b"nodemere:visitor:key:v1", "sha256")
    if fallback:
        return hmac.digest(fallback.encode(), b"nodemere:visitor:service-role-fallback:v1", "sha256")
    raise failure(503, "visitor_unavailable")


def visitor_token(visitor_id, key):
    signature = hmac.new(key, ("capability:v1:" + str(visitor_id)).encode(), hashlib.sha256).hexdigest()
    return "v1." + signature


def has_proof(visitor_id, token, key):
    return isinstance(token, str) and bool(re.fullmatch(r"v1\.[a-f0-9]{64}", token)) and hmac.compare_digest(visitor_token(visitor_id, key), token)


def rotated_id(visitor_id, user_id, key):
    digest = hmac.digest(key, f"rotation:v1:{visitor_id}:{user_id}".encode(), "sha256")
    return UUID(bytes=digest[:16], version=4)


def fingerprint(visitor_id, device, key):
    # Device signals describe broad cohorts. The UUID privacy partition makes
    # cross-visitor comparison intentionally useless, including private browsing.
    signals = {name: getattr(device, name) for name in ("browser", "os", "device_type", "touch_support")}
    for name in ("screen_width", "screen_height"):
        value = getattr(device, name)
        signals[name] = math.floor(value / 256) * 256 if value else None
    canonical = json.dumps({"visitor_id": str(visitor_id), "signals": signals}, sort_keys=True, separators=(",", ":"))
    return hmac.new(key, ("fingerprint:v1:" + canonical).encode(), hashlib.sha256).hexdigest()


class RateLimiter:
    """Process-local bounded buckets; deploy an edge limit for multiple workers.

    No IP/user/token values are retained: keys are keyed, domain-separated hashes.
    At capacity fail closed instead of evicting active buckets to bypass limits.
    """
    def __init__(self, maximum=4096, clock=time.monotonic):
        self.maximum, self.clock = maximum, clock
        self.buckets = OrderedDict()
        self.lock = Lock()

    def check(self, subject, key, limit=120):
        bucket_id = hmac.digest(key, ("rate:v1:" + subject).encode(), "sha256")
        now = self.clock()
        with self.lock:
            while self.buckets and next(iter(self.buckets.values()))[0] <= now - 60:
                self.buckets.popitem(last=False)
            start, count = self.buckets.get(bucket_id, (now, 0))
            if count >= limit or (bucket_id not in self.buckets and len(self.buckets) >= self.maximum):
                raise HTTPException(429, {"code": "visitor_rate_limited"}, headers={"Retry-After": "60"})
            self.buckets[bucket_id] = (start, count + 1)


def validate_origin(request):
    origin = request.headers.get("origin", "")
    if origin in PRODUCTION_ORIGINS:
        return False
    try:
        parts = urlsplit(origin)
        local = (parts.scheme in {"http", "https"} and parts.hostname in {"localhost", "127.0.0.1", "::1"}
                 and not parts.path and not parts.query and not parts.fragment and not parts.username and not parts.password
                 and (parts.port is None or 0 < parts.port <= 65535))
    except ValueError:
        local = False
    if local:
        return True
    raise failure(403, "visitor_origin_not_allowed")


def duplicate_free_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate key")
        result[key] = value
    return result


async def read_payload(request, model):
    if request.headers.get("content-type", "").split(";", 1)[0].strip().lower() != "application/json":
        raise failure(415, "visitor_json_required")
    if request.headers.get("content-encoding", "identity").lower() != "identity":
        raise failure(415, "visitor_encoding_not_supported")
    length = request.headers.get("content-length")
    if length is not None:
        if not length.isdigit():
            raise failure(400, "visitor_invalid_request")
        if int(length) > MAX_BODY_BYTES:
            raise failure(413, "visitor_payload_too_large")
    body = bytearray()
    async for chunk in request.stream():
        if len(body) + len(chunk) > MAX_BODY_BYTES:
            raise failure(413, "visitor_payload_too_large")
        body.extend(chunk)
    try:
        json.loads(body, object_pairs_hook=duplicate_free_object)
        # JSON mode accepts ISO timestamps/UUIDs, while strict=True rejects
        # coercion of booleans, numeric strings and arbitrary scalar values.
        payload = model.model_validate_json(body)
    except (ValidationError, ValueError, RecursionError):
        # Never echo input values (including unknown keys) from validation errors.
        raise failure(422, "visitor_invalid_payload") from None
    now = datetime.now(timezone.utc)
    consent = getattr(payload, "consent", None)
    if consent and consent.updated_at > now + timedelta(minutes=5):
        raise failure(422, "visitor_invalid_timestamp")
    for event in getattr(payload, "events", []):
        if event.occurred_at > now + timedelta(minutes=5) or event.occurred_at < now - timedelta(hours=24):
            raise failure(422, "visitor_invalid_timestamp")
    return payload


def service_database(db):
    from .authorization import ScopedClient
    return db.raw if isinstance(db, ScopedClient) else db


def rpc(db, name, params):
    try:
        result = service_database(db).rpc(name, params).execute().data
        if isinstance(result, list):
            result = result[0] if len(result) == 1 else None
        return result
    except Exception as exc:
        # Only known static DB codes may cross the endpoint boundary.
        message = getattr(exc, "message", "")
        known = {"visitor_identity_required", "visitor_revoked", "visitor_not_found", "visitor_user_not_found", "visitor_event_conflict"}
        if message in known:
            raise HTTPException(409, {"code": message}) from None
        if getattr(exc, "code", None) == "22023":
            raise failure(422, "visitor_invalid_payload") from None
        raise failure(503, "visitor_unavailable") from None


def result_identity(result, expected):
    if isinstance(result, str):
        result = {"visitor_id": result}
    try:
        if not isinstance(result, dict) or UUID(str(result.get("visitor_id"))) != expected:
            raise ValueError()
        return result
    except (ValueError, TypeError, AttributeError):
        raise failure(503, "visitor_unavailable") from None


def account_created_at(user):
    # Supabase Auth creation is authoritative; profile bootstrap can lag days.
    value = user.created_at
    if isinstance(value, str):
        value = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if not isinstance(value, datetime) or value.tzinfo is None:
        raise ValueError("Account timestamp unavailable")
    return value.isoformat()


def build_visitor_router(db, authenticate):
    router = APIRouter(prefix="/api/public/visitor", tags=["Visitor Collection"])
    limiter = RateLimiter()

    async def prepare(request, model):
        if model is not RevokeInput and not enabled():
            return None
        internal = validate_origin(request)
        if internal and not enabled("VISITOR_ALLOW_LOCAL"):
            return None
        if model is not RevokeInput and (request.headers.get("sec-gpc") == "1" or request.headers.get("dnt") == "1"):
            return None
        key = signing_key()
        # Intentionally ignore Forwarded/X-Forwarded-For/X-Real-IP headers.
        peer = request.client.host if request.client else "unknown"
        limiter.check("peer:" + peer, key)
        payload = await read_payload(request, model)
        limiter.check("visitor:" + str(payload.visitor_id), key, 60)
        return payload, key, internal

    @router.post("/collect")
    async def collect(request: Request):
        prepared = await prepare(request, CollectInput)
        if prepared is None:
            return Response(status_code=204)
        payload, key, internal = prepared
        proof = has_proof(payload.visitor_id, payload.visitor_token, key)
        if payload.visitor_token is not None and not proof:
            raise HTTPException(409, {"code": "visitor_identity_required"})
        now = datetime.now(timezone.utc).isoformat()
        normalized = {
            "visitor_id": str(payload.visitor_id), "session_id": str(payload.session_id),
            "fingerprint": fingerprint(payload.visitor_id, payload.device, key),
            "fingerprint_version": 1, "fingerprint_confidence": 60,
            "fingerprint_updated_at": now,
            "identity_match_method": "persistent_id" if proof else "new",
            "identity_confidence": 100 if proof else 0, "has_identity_proof": bool(proof),
            "consent": payload.consent.model_dump(mode="json"),
            "attribution": payload.attribution.model_dump(mode="json", exclude_none=True),
            "device_profile": payload.device.model_dump(mode="json", exclude_none=True),
            "is_bot": bool(re.search(r"bot|crawl|spider|headless|healthcheck|uptime|monitor|lighthouse", request.headers.get("user-agent", "")[:1024], re.I)),
            "is_internal": internal,
            "events": [event.model_dump(mode="json", exclude_none=True) for event in payload.events],
        }
        # The RPC also bounds its normalized JSONB input. Include enrichment and
        # PostgreSQL's separators so a full wire batch gets a stable 413, not 503.
        if len(json.dumps(normalized, ensure_ascii=False).encode()) > MAX_BODY_BYTES:
            raise failure(413, "visitor_payload_too_large")
        result = result_identity(await run_in_threadpool(rpc, db, "visitor_ingest_phase2", {"p_payload": normalized}), payload.visitor_id)
        try:
            session_id = str(UUID(str(result["session_id"])))
            accepted = result["accepted"]
            if type(accepted) is not int or not 0 <= accepted <= len(payload.events):
                raise ValueError()
        except (ValueError, KeyError, TypeError):
            raise failure(503, "visitor_unavailable") from None
        return {"visitor_id": str(payload.visitor_id), "visitor_token": visitor_token(payload.visitor_id, key), "session_id": session_id, "accepted": accepted}

    @router.post("/identity")
    async def identity(request: Request):
        prepared = await prepare(request, IdentityInput)
        if prepared is None:
            return Response(status_code=204)
        payload, key, _internal = prepared
        if not has_proof(payload.visitor_id, payload.visitor_token, key):
            raise HTTPException(409, {"code": "visitor_identity_required"})
        auth = request.headers.get("authorization", "")
        if len(auth) > 8192 or not re.fullmatch(r"Bearer [^\s]+", auth, re.I):
            raise failure(401, "visitor_authentication_required")
        try:
            user = await authenticate(SimpleNamespace(credentials=auth.split(" ", 1)[1]))
            user_id = str(UUID(str(user.id)))
            created = account_created_at(user)
        except HTTPException as exc:
            raise failure(exc.status_code if exc.status_code in {401, 403, 503} else 503, "visitor_authentication_unavailable") from None
        except Exception:
            raise failure(503, "visitor_authentication_unavailable") from None
        request.state.authenticated_user_id = user_id
        limiter.check("account:" + user_id, key, 30)
        params = {"p_visitor_id": str(payload.visitor_id), "p_user_id": user_id,
                  "p_account_created_at": created, "p_occurred_at": datetime.now(timezone.utc).isoformat()}
        result = result_identity(await run_in_threadpool(rpc, db, "visitor_link_identity", params), payload.visitor_id)
        target, rotated, requires_collect = payload.visitor_id, False, False
        if result.get("conflict"):
            target, rotated = rotated_id(payload.visitor_id, user_id, key), True
            try:
                rotated_result = result_identity(await run_in_threadpool(rpc, db, "visitor_link_identity", {**params, "p_visitor_id": str(target)}), target)
                if rotated_result.get("conflict"):
                    raise HTTPException(409, {"code": "visitor_identity_required"})
            except HTTPException as exc:
                if exc.status_code == 409 and exc.detail == {"code": "visitor_not_found"}:
                    requires_collect = True
                else:
                    raise
        return {"visitor_id": str(target), "visitor_token": visitor_token(target, key), "rotated": rotated, "requires_collect": requires_collect}

    @router.post("/revoke")
    async def revoke(request: Request):
        prepared = await prepare(request, RevokeInput)
        if prepared is None:
            return Response(status_code=204)
        payload, key, _internal = prepared
        if not has_proof(payload.visitor_id, payload.visitor_token, key):
            raise HTTPException(409, {"code": "visitor_identity_required"})
        await run_in_threadpool(rpc, db, "visitor_revoke", {"p_visitor_id": str(payload.visitor_id)})
        return Response(status_code=204)

    return router


VISITOR_RANGES = {
    "today": timedelta(days=1),
    "7d": timedelta(days=7),
    "30d": timedelta(days=30),
    "90d": timedelta(days=90),
}


def visitor_intelligence_window(value, now=None):
    now = now or datetime.now(timezone.utc)
    if value == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif value == "all":
        start = datetime(2000, 1, 1, tzinfo=timezone.utc)
    elif value in VISITOR_RANGES:
        start = now - VISITOR_RANGES[value]
    else:
        raise failure(422, "visitor_intelligence_invalid_filter")
    return start.isoformat(), now.isoformat()


def visitor_intelligence_authorized(user):
    """The production command center is opt-in for explicitly listed staff."""
    user_id = str(getattr(user, "id", ""))
    email = str(getattr(user, "email", "") or "").strip().lower()
    allowed_ids = {value.strip() for value in os.getenv("VISITOR_INTELLIGENCE_ADMIN_USER_IDS", "").split(",") if value.strip()}
    allowed_emails = {value.strip().lower() for value in os.getenv("VISITOR_INTELLIGENCE_ADMIN_EMAILS", "").split(",") if value.strip()}
    if user_id in allowed_ids or email and email in allowed_emails:
        return True
    is_production = os.getenv("NODEMERE_ENV", "").lower() == "production" or bool(os.getenv("RENDER"))
    return not is_production and enabled("VISITOR_INTELLIGENCE_ALLOW_LOCAL_AUTHENTICATED")


def visitor_intelligence_include_internal():
    """Expose localhost test traffic only when explicitly enabled in development."""
    is_production = os.getenv("NODEMERE_ENV", "").lower() == "production" or bool(os.getenv("RENDER"))
    return not is_production and enabled("VISITOR_INTELLIGENCE_INCLUDE_INTERNAL_LOCAL")


def visitor_intelligence_rpc(db, name, params):
    try:
        result = service_database(db).rpc(name, params).execute().data
        if isinstance(result, list):
            result = result[0] if len(result) == 1 else result
        if result is None:
            raise failure(503, "visitor_intelligence_unavailable")
        return result
    except HTTPException:
        raise
    except Exception as exc:
        message = getattr(exc, "message", "")
        if message == "visitor_intelligence_not_found" or getattr(exc, "code", None) == "P0002":
            raise failure(404, "visitor_intelligence_not_found") from None
        if message == "visitor_intelligence_invalid_filter" or getattr(exc, "code", None) == "22023":
            raise failure(422, "visitor_intelligence_invalid_filter") from None
        logging.warning("visitor_intelligence.read.event_1")
        raise failure(503, "visitor_intelligence_unavailable") from None


def build_visitor_intelligence_router(db, authenticate):
    """Server-only analytics adapter. Browser roles have no database read grant."""
    router = APIRouter(prefix="/api/visitor-intelligence", tags=["Visitor Intelligence"])

    async def internal_user(user=Depends(authenticate)):
        authorized = visitor_intelligence_authorized(user)
        if not authorized:
            raise failure(403, "visitor_intelligence_forbidden")
        return user

    def filters(range_name, device, segment, conversion, source, campaign, section):
        start, end = visitor_intelligence_window(range_name)
        return {
            "p_start": start,
            "p_end": end,
            "p_device": None if device == "all" else device,
            "p_segment": None if segment == "all" else segment,
            "p_converted": None if conversion == "all" else conversion == "converted",
            "p_source": source or None,
            "p_campaign": campaign or None,
            "p_section": section or None,
            "p_include_internal": visitor_intelligence_include_internal(),
        }

    @router.get("/access")
    async def access(response: Response, _user=Depends(internal_user)):
        response.headers["Cache-Control"] = "private, no-store"
        return {"authorized": True}

    @router.get("/command-center")
    async def command_center(
        response: Response,
        range_name: Literal["today", "7d", "30d", "90d", "all"] = Query(default="7d", alias="range"),
        device: Literal["all", "desktop", "tablet", "mobile", "unknown"] = "all",
        segment: Literal["all", "new", "returning"] = "all",
        conversion: Literal["all", "converted", "non_converted"] = "all",
        source: str | None = Query(default=None, max_length=100),
        campaign: str | None = Query(default=None, max_length=100),
        section: str | None = Query(default=None, max_length=80),
        _user=Depends(internal_user),
    ):
        response.headers["Cache-Control"] = "private, no-store"
        params = filters(range_name, device, segment, conversion, source, campaign, section)
        return await run_in_threadpool(visitor_intelligence_rpc, db, "visitor_intelligence_command_center", params)

    @router.get("/visitors")
    async def visitors(
        response: Response,
        range_name: Literal["today", "7d", "30d", "90d", "all"] = Query(default="7d", alias="range"),
        page: int = Query(default=1, ge=1, le=100000),
        page_size: int = Query(default=25, ge=1, le=100),
        search: str | None = Query(default=None, max_length=100),
        sort: Literal["last_seen_desc", "first_seen_desc", "visits_desc", "engaged_desc", "pageviews_desc"] = "last_seen_desc",
        device: Literal["all", "desktop", "tablet", "mobile", "unknown"] = "all",
        status: Literal["all", "new", "returning", "anonymous", "registered", "converted"] = "all",
        source: str | None = Query(default=None, max_length=100),
        campaign: str | None = Query(default=None, max_length=100),
        section: str | None = Query(default=None, max_length=80),
        _user=Depends(internal_user),
    ):
        response.headers["Cache-Control"] = "private, no-store"
        start, end = visitor_intelligence_window(range_name)
        params = {
            "p_start": start, "p_end": end, "p_page": page, "p_page_size": page_size,
            "p_search": search or None, "p_sort": sort,
            "p_device": None if device == "all" else device,
            "p_status": None if status == "all" else status,
            "p_source": source or None, "p_campaign": campaign or None, "p_section": section or None,
            "p_include_internal": visitor_intelligence_include_internal(),
        }
        return await run_in_threadpool(visitor_intelligence_rpc, db, "visitor_intelligence_visitors", params)

    @router.get("/visitors/{visitor_id}")
    async def visitor_profile(visitor_id: UUID, response: Response, _user=Depends(internal_user)):
        response.headers["Cache-Control"] = "private, no-store"
        return await run_in_threadpool(visitor_intelligence_rpc, db, "visitor_intelligence_profile", {
            "p_visitor_id": str(visitor_id),
            "p_include_internal": visitor_intelligence_include_internal(),
        })

    @router.get("/activity")
    async def activity(
        response: Response,
        since: AwareDatetime | None = None,
        limit: int = Query(default=30, ge=1, le=100),
        _user=Depends(internal_user),
    ):
        response.headers["Cache-Control"] = "private, no-store"
        params = {
            "p_since": since.isoformat() if since else None,
            "p_limit": limit,
            "p_include_internal": visitor_intelligence_include_internal(),
        }
        return await run_in_threadpool(visitor_intelligence_rpc, db, "visitor_intelligence_activity", params)

    return router


def record_verified_subscription(db, user_id, subscription_id, occurred_at):
    """Trusted paid-event helper only; never call from a browser or plan update.

    The caller must establish live platform payment. SQL deduplicates globally
    by subscription, updates already-consented visitors, and ignores revoked IDs.
    """
    if not enabled():
        return None
    return rpc(db, "visitor_subscription_conversion", {
        "p_user_id": str(UUID(str(user_id))), "p_subscription_id": subscription_id,
        "p_occurred_at": occurred_at.isoformat() if isinstance(occurred_at, datetime) else occurred_at,
    })


def provider_id(value, prefix):
    if isinstance(value, dict):
        value = value.get("id")
    return value if isinstance(value, str) and re.fullmatch(prefix + r"_[A-Za-z0-9]{1,200}", value) else None


def positive_amount(value):
    return type(value) is int and value > 0


def record_verified_billing_event(db, event):
    """Call only AFTER Stripe construct_event succeeds. Analytics cannot fail billing.

    A paid conversion is a positive-amount, paid subscription invoice/Checkout
    from the platform's live Stripe account. Trials, zero-dollar promotions,
    active status, simulation, Connect payments and test events do not qualify.
    No card/contact details or Stripe payloads reach the conversion RPC.
    """
    if not enabled():
        return None
    try:
        if event.get("account") or event.get("livemode") is not True:
            return None
        obj = (event.get("data") or {}).get("object") or {}
        if event.get("type") == "invoice.paid":
            if not positive_amount(obj.get("amount_paid")):
                return None
            subscription = obj.get("subscription") or (((obj.get("parent") or {}).get("subscription_details") or {}).get("subscription"))
        elif event.get("type") == "checkout.session.completed":
            if obj.get("mode") != "subscription" or obj.get("payment_status") != "paid" or not positive_amount(obj.get("amount_total")):
                return None
            subscription = obj.get("subscription")
        else:
            return None
        subscription_id = provider_id(subscription, "sub")
        customer_id = provider_id(obj.get("customer"), "cus")
        if not subscription_id or not customer_id:
            return None
        rows = service_database(db).table("users").select("id").eq("stripe_customer_id", customer_id).limit(2).execute().data or []
        if len(rows) != 1:
            return None
        # The signed payment establishes subscription/customer ownership. The
        # profile subscription may be missing or refer to a previous purchase.
        created = event.get("created")
        if type(created) is not int or created <= 0:
            return None
        occurred = datetime.fromtimestamp(created, timezone.utc)
        return record_verified_subscription(db, rows[0]["id"], subscription_id, occurred)
    except Exception:
        logging.warning("visitor_intelligence.conversion.event_1")
        return None
