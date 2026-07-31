"""Testing-only identity verification sessions.

The service deliberately knows nothing about how a link is delivered. That keeps
the session lifecycle reusable when a real delivery provider is added later.
"""

from typing import Optional

from .request_service import (
    REQUEST_TTL_MINUTES,
    complete_request,
    create_request,
    get_public_request,
    get_request_status,
)


def create_verification_session(
    supabase,
    *,
    base_url: str,
    business_id=None,
    person_id=None,
    phone: Optional[str] = None,
    user_id=None,
    metadata: Optional[dict] = None,
) -> dict:
    return create_request(supabase, base_url=base_url, path_prefix="verify", request_type="auth", business_id=business_id, person_id=person_id, phone=phone, user_id=user_id, metadata=metadata)


def get_verification_status(
    supabase,
    *,
    token: Optional[str] = None,
    session_id: Optional[str] = None,
    business_id=None,
) -> dict:
    result = get_request_status(supabase, request_id=session_id, token=token, request_type="auth", business_id=business_id)
    if result.get("status") == "completed":
        result["status"] = "verified"
    return result


def get_public_verification(supabase, token: str) -> dict:
    result = get_public_request(supabase, token, "auth")
    if result.get("status") == "completed":
        result["status"] = "verified"
    return result


def complete_verification(supabase, token: str) -> dict:
    result = complete_request(supabase, token, "auth", completed_status="completed")
    if result.get("status") == "completed":
        result["status"] = "verified"
    return result
