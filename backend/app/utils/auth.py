from datetime import datetime, timedelta, timezone
from typing import Optional
import jwt
from jwt.exceptions import PyJWTError, InvalidTokenError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status, Query, Cookie, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.config.settings import settings
from app.database.base import get_db
from app.models.models import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
# auto_error=False permits optional auth extraction (e.g. for browser GET PDF downloads)
bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except (PyJWTError, InvalidTokenError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


def _get_user_from_token_str(token: str, db: Session) -> Optional[User]:
    """Helper to decode token and look up active user."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        sub = payload.get("sub")
        user_id = payload.get("user_id")
        if not sub and not user_id:
            return None

        target_id = user_id or sub
        try:
            uid = int(target_id)
            user = db.query(User).filter(User.id == uid, User.is_active == True).first()
            if user:
                return user
        except (ValueError, TypeError):
            pass

        if sub:
            return db.query(User).filter(User.username == str(sub), User.is_active == True).first()
    except Exception:
        return None
    return None


def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    access_token: Optional[str] = Cookie(None),
    token: Optional[str] = Query(None, description="Auth token via query parameter"),
    db: Session = Depends(get_db),
) -> User:
    """
    Hybrid authentication:
    1. Checks HttpOnly 'access_token' cookie (primary for secure web browsers, immune to XSS).
    2. Checks Authorization Bearer header (for mobile apps, CLI, API integrations).
    3. Checks ?token= query parameter (for direct file/PDF preview downloads).
    """
    token_str = None
    if access_token:
        token_str = access_token
    elif request and request.cookies.get("access_token"):
        token_str = request.cookies.get("access_token")
    elif credentials and credentials.credentials:
        token_str = credentials.credentials
    elif token:
        token_str = token

    if not token_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = _get_user_from_token_str(token_str, db)
    if not user:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


def get_current_user_optional(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    access_token: Optional[str] = Cookie(None),
    token: Optional[str] = Query(None, description="Auth token via query parameter"),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Optional authentication: returns active User if authenticated, else None without 401 error."""
    token_str = None
    if access_token:
        token_str = access_token
    elif request and request.cookies.get("access_token"):
        token_str = request.cookies.get("access_token")
    elif credentials and credentials.credentials:
        token_str = credentials.credentials
    elif token:
        token_str = token

    if not token_str:
        return None

    return _get_user_from_token_str(token_str, db)


def require_owner(current_user: User = Depends(get_current_user)) -> User:
    from app.models.models import UserRole
    if current_user.role != UserRole.OWNER:
        raise HTTPException(status_code=403, detail="Owner access required")
    return current_user
