"""Small security helpers shared by existing routes (no external services)."""

import json
import hashlib
import hmac
import time
from jose import jwt, JWTError
from urllib.parse import urlsplit

from fastapi import HTTPException


def _context_key(secret):
    if not secret:
        raise HTTPException(503, "Internal tool authentication is not configured")
    return hmac.new(secret.encode(), b"nodemere/internal-tenant-context/v1", hashlib.sha256).hexdigest()


def issue_internal_context(secret, business, *, lifetime=5400):
    return jwt.encode({"aud": "nodemere-internal-context", "iss": "nodemere",
        "sub": str(business["user_id"]), "business_id": str(business["id"]),
        "iat": int(time.time()), "exp": int(time.time()) + lifetime}, _context_key(secret), algorithm="HS256")


def verify_internal_context(secret, token, *, allow_expired=False):
    try:
        claims = jwt.decode(token, _context_key(secret), algorithms=["HS256"],
                          audience="nodemere-internal-context", issuer="nodemere",
                          options={"require_exp": not allow_expired, "require_sub": True, "require_aud": True,
                                   "verify_exp": not allow_expired})
        # python-jose's require_exp also enables expiry validation. A late,
        # provider-authenticated webhook still needs a signed numeric expiry.
        if not isinstance(claims.get('exp'), (int, float)):
            raise JWTError('Missing expiry')
        return claims
    except JWTError:
        raise HTTPException(403, "Invalid or expired tool business context")


def script_safe_json(value) -> str:
    """JSON embedded in HTML must not be able to terminate the script element."""
    return (json.dumps(value)
            .replace("&", "\\u0026")
            .replace("<", "\\u003c")
            .replace(">", "\\u003e"))


def safe_oauth_return_to(value: str | None, frontend_url: str | None) -> str:
    """Allow relative app paths or the configured frontend origin, never others."""
    target = value or frontend_url or "/"
    if any(ord(char) < 32 for char in target) or "\\" in target:
        raise HTTPException(status_code=400, detail="Invalid integration return URL.")
    parsed = urlsplit(target)
    if target.startswith("/") and not target.startswith("//") and not parsed.netloc:
        return target
    configured = urlsplit(frontend_url or "")
    try:
        allowed = (
            parsed.scheme in {"http", "https"}
            and parsed.hostname is not None
            and not parsed.username and not parsed.password
            and (parsed.scheme, parsed.hostname, parsed.port)
            == (configured.scheme, configured.hostname, configured.port)
        )
    except ValueError:
        allowed = False
    if not allowed:
        raise HTTPException(status_code=400, detail="Invalid integration return URL.")
    return target
