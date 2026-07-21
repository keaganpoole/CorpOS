"""Short-lived, tokenized requests used by caller-facing links."""

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import quote

REQUEST_TTL_MINUTES = 10
REQUEST_TABLE = "requests"


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def parse_datetime(value) -> Optional[datetime]:
    if not value:
        return None
    parsed = value if isinstance(value, datetime) else datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def is_expired(row: dict, now: Optional[datetime] = None) -> bool:
    expires_at = parse_datetime(row.get("expires_at"))
    return bool(expires_at and expires_at <= (now or now_utc()))


def expire_if_needed(supabase, row: dict) -> dict:
    if row.get("status") == "pending" and is_expired(row):
        response = (
            supabase.table(REQUEST_TABLE).update({"status": "expired", "updated_at": now_utc().isoformat()})
            .eq("id", row["id"]).eq("status", "pending").execute()
        )
        if response.data:
            return response.data[0]
        return {**row, "status": "expired"}
    return row


def load_request_by_token(supabase, token: str, request_type: Optional[str] = None) -> Optional[dict]:
    query = supabase.table(REQUEST_TABLE).select("*").eq("token_hash", token_hash(token)).limit(1)
    if request_type:
        query = query.eq("request_type", request_type)
    response = query.execute()
    return (response.data or [None])[0]


def status_response(row: dict, *, public_status: Optional[str] = None) -> dict:
    return {
        "success": True,
        "request_id": str(row.get("id")),
        "session_id": str(row.get("id")),
        "request_type": row.get("request_type"),
        "status": public_status or row.get("status") or "pending",
        "expires_at": row.get("expires_at"),
        "completed_at": row.get("completed_at"),
    }


def create_request(
    supabase, *, base_url: str, path_prefix: str, request_type: str,
    business_id=None, person_id=None, phone=None, user_id=None, metadata: Optional[dict] = None,
    link_key: str = "verification_url",
) -> dict:
    token = secrets.token_urlsafe(32)
    created_at = now_utc()
    expires_at = created_at + timedelta(minutes=REQUEST_TTL_MINUTES)
    row = {
        "request_type": request_type, "business_id": business_id, "person_id": person_id,
        "phone": phone, "user_id": user_id, "token_hash": token_hash(token), "status": "pending",
        "expires_at": expires_at.isoformat(), "metadata": metadata or {},
        "created_at": created_at.isoformat(), "updated_at": created_at.isoformat(),
    }
    response = supabase.table(REQUEST_TABLE).insert(row).execute()
    saved = (response.data or [row])[0]
    url = f"{base_url.rstrip('/')}/{path_prefix.strip('/')}/{quote(token, safe='')}"
    logging.info("[request][mock-delivery] request_type=%s url=%s", request_type, url)
    return {
        "success": True, "request_id": str(saved.get("id")), "session_id": str(saved.get("id")),
        "request_type": request_type, "status": "pending",
        "expires_at": saved.get("expires_at", expires_at.isoformat()), link_key: url,
    }


def get_request_status(supabase, *, request_id=None, token=None, request_type=None, business_id=None) -> dict:
    row = load_request_by_token(supabase, token, request_type) if token else None
    if not row and request_id:
        query = supabase.table(REQUEST_TABLE).select("*").eq("id", str(request_id)).limit(1)
        if business_id is not None:
            query = query.eq("business_id", business_id)
        if request_type:
            query = query.eq("request_type", request_type)
        response = query.execute()
        row = (response.data or [None])[0]
    if not row:
        return {"success": False, "status": "not_found", "message": "Request not found"}
    row = expire_if_needed(supabase, row)
    return status_response(row)


def get_public_request(supabase, token: str, request_type: str) -> dict:
    row = load_request_by_token(supabase, token, request_type)
    if not row:
        return {"success": False, "status": "not_found", "message": "This link is invalid."}
    row = expire_if_needed(supabase, row)
    if row.get("status") == "expired":
        return {"success": False, "status": "expired", "message": "This link has expired."}
    return status_response(row)


def complete_request(supabase, token: str, request_type: str, completed_status: str = "completed") -> dict:
    row = load_request_by_token(supabase, token, request_type)
    if not row:
        return {"success": False, "status": "not_found", "message": "This link is invalid."}
    row = expire_if_needed(supabase, row)
    if row.get("status") == completed_status:
        return status_response(row)
    if row.get("status") == "expired":
        return {"success": False, "status": "expired", "message": "This link has expired."}
    completed_at = now_utc().isoformat()
    response = (
        supabase.table(REQUEST_TABLE).update({"status": completed_status, "completed_at": completed_at, "updated_at": completed_at})
        .eq("id", row["id"]).eq("status", "pending").gt("expires_at", completed_at).execute()
    )
    if response.data:
        return status_response(response.data[0])
    latest = load_request_by_token(supabase, token, request_type)
    if latest and latest.get("status") == completed_status:
        return status_response(latest)
    return {"success": False, "status": "not_completed", "message": "The request could not be completed."}
