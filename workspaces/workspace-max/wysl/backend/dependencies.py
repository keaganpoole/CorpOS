# backend/dependencies.py
import os
from uuid import UUID
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import BaseModel # type: ignore
from config import ALGORITHM, SECRET_KEY, supabase_auth

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

class TokenData(BaseModel):
    rep_id: str | None = None

async def get_current_user(token: str = Depends(HTTPBearer())):
    try:
        user_info = supabase_auth.auth.get_user(token.credentials)
        if user_info and user_info.user:
            return user_info.user
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
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
