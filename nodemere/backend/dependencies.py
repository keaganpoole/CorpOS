# backend/dependencies.py
from types import SimpleNamespace
import logging
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import BaseModel # type: ignore
from supabase_auth.errors import AuthApiError
from .config import ALGORITHM, SECRET_KEY, supabase_admin, supabase_auth
from .authorization import current_identity

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
http_bearer = HTTPBearer()

class TokenData(BaseModel):
    rep_id: str | None = None

def _build_authenticated_user(payload: dict):
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user_metadata = payload.get("user_metadata")
    app_metadata = payload.get("app_metadata")
    return SimpleNamespace(
        id=user_id,
        email=payload.get("email"),
        phone=payload.get("phone"),
        role=payload.get("role"),
        aud=payload.get("aud"),
        user_metadata=user_metadata if isinstance(user_metadata, dict) else {},
        app_metadata=app_metadata if isinstance(app_metadata, dict) else {},
        raw_app_meta_data=app_metadata if isinstance(app_metadata, dict) else {},
        raw_user_meta_data=user_metadata if isinstance(user_metadata, dict) else {},
    )


async def get_current_user(token = Depends(http_bearer)):
    # Only Supabase Auth may authenticate dashboard users. Locally signed OAuth
    # state and legacy rep tokens are NOT Supabase access tokens, even if they
    # contain a sub claim and share a historical signing key.
    stage = "auth"
    try:
        identity = current_identity.get()
        if identity is not None:
            return identity
        user_info = supabase_auth.auth.get_user(token.credentials)
        if user_info and user_info.user:
            stage = "profile"
            profile = supabase_admin.table("users").select("account_status").eq("id", str(user_info.user.id)).limit(1).execute()
            if not profile.data:
                # Preserve first OAuth/signup bootstrap when a deployment has
                # no profile trigger. Only verified Auth identity and safe
                # defaults are copied; metadata cannot grant a plan or role.
                supabase_admin.table("users").insert({"id":str(user_info.user.id),
                    "email":getattr(user_info.user,"email",None),"onboarded":False}).execute()
            elif profile.data[0].get("account_status") in {"closed", "pending_deletion", "disabled"}:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account is closed.")
            # Only inspect assurance claims AFTER Supabase validated this exact
            # bearer token. OAuth provider metadata never establishes AAL2.
            try:
                claims = jwt.get_unverified_claims(token.credentials)
                aal = claims.get("aal", "aal1") if str(claims.get("sub")) == str(user_info.user.id) else "aal1"
            except Exception:
                aal = "aal1"
            stage = "identity"
            values = user_info.user.model_dump() if hasattr(user_info.user, "model_dump") else vars(user_info.user).copy()
            values["nodemere_aal"] = "aal2" if aal == "aal2" else "aal1"
            values["nodemere_mfa_enrolled"] = any((f.get("status") if isinstance(f,dict) else getattr(f,"status",None)) == "verified" for f in (values.get("factors") or []))
            return SimpleNamespace(**values)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except HTTPException:
        raise
    except Exception as exc:
        # Only an explicit Auth rejection is evidence of invalid credentials.
        # Transport, rate-limit, response parsing and profile/database failures
        # must fail closed without falsely telling the client to log out.
        if stage == "auth" and isinstance(exc, AuthApiError) and exc.status in {400, 401, 403, 422}:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired authentication token.") from None
        # No token, email, provider body or traceback: these can contain secrets.
        # Use the existing allowlisted operational event format so the privacy
        # filter preserves this fixed stage code and request correlation ID.
        logging.warning("dependencies." + stage + ".event_1")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Authentication is temporarily unavailable. Please try again.") from None

async def get_current_rep(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Please log in to view commissions.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        rep_id: str = payload.get("sub")
        if rep_id is None:
            raise credentials_exception
        token_data = TokenData(rep_id=rep_id)
    except JWTError:
        raise credentials_exception
    
    # You could add a check here to see if the rep still exists in the DB
    # For now, we'll trust the token payload
    return token_data.rep_id
