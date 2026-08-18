# backend/dependencies.py
from types import SimpleNamespace
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import BaseModel # type: ignore
from .config import ALGORITHM, SECRET_KEY, supabase_admin, supabase_auth

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
    try:
        if SECRET_KEY:
            payload = jwt.decode(
                token.credentials,
                SECRET_KEY,
                algorithms=[ALGORITHM],
                options={"verify_aud": False},
            )
            user = _build_authenticated_user(payload)
            profile = supabase_admin.table("users").select("account_status").eq("id", str(user.id)).limit(1).execute()
            if profile.data and profile.data[0].get("account_status") in {"closed", "pending_deletion"}:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account is closed.")
            return user
    except JWTError:
        pass
    except HTTPException:
        raise

    try:
        user_info = supabase_auth.auth.get_user(token.credentials)
        if user_info and user_info.user:
            profile = supabase_admin.table("users").select("account_status").eq("id", str(user_info.user.id)).limit(1).execute()
            if profile.data and profile.data[0].get("account_status") in {"closed", "pending_deletion"}:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account is closed.")
            return user_info.user
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Authentication error: {str(e)}")

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
