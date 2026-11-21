from datetime import datetime, timedelta, timezone
from typing import Optional
import bcrypt
import jwt
from jwt.exceptions import PyJWTError, InvalidTokenError
from fastapi import Depends, HTTPException, status, Cookie, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.config.settings import settings
from app.database.base import get_db
from app.models.models import User, UserRole

bearer_scheme = HTTPBearer(auto_error=False)
_BCRYPT_ROUNDS = 12


def _password_bytes(password: str) -> bytes:
    """Encode password as UTF-8 and clamp to bcrypt's 72-byte input limit."""
    return (password or "").encode("utf-8")[:72]


def hash_password(password: str) -> str:
    hashed = bcrypt.hashpw(_password_bytes(password), bcrypt.gensalt(rounds=_BCRYPT_ROUNDS))
    return hashed.decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    if not plain or not hashed:
        return False
    try:
        return bcrypt.checkpw(_password_bytes(plain), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def create_user_access_token(user: User, expires_delta: Optional[timedelta] = None) -> str:
    """Issue a signed JWT bound to user.id and user.token_version for server-side revocation (S6)."""
    return create_access_token(
        {
            "sub": str(user.id),
            "tv": int(getattr(user, "token_version", 1) or 1),
        },
        expires_delta=expires_delta,
    )


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
    """Decode JWT, look up active user strictly by numeric ID, and verify token_version (S6)."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        raw_id = payload.get("user_id") if payload.get("user_id") is not None else payload.get("sub")
        if raw_id is None:
            return None

        try:
            uid = int(raw_id)
        except (ValueError, TypeError):
            return None

        user = db.query(User).filter(User.id == uid, User.is_active == True).first()
        if not user:
            return None

        current_tv = int(getattr(user, "token_version", 1) or 1)
        token_tv = payload.get("tv")
        resolved_tv = int(token_tv) if token_tv is not None else 1
        if resolved_tv != current_tv:
            return None

        return user
    except Exception:
        return None


def _extract_token(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials],
    access_token: Optional[str],
) -> Optional[str]:
    """
    Extract bearer credentials from secure channels only:
    1. Authorization: Bearer header (takes precedence for explicit API/client requests)
    2. HttpOnly 'access_token' cookie (browser sessions, XSS-safe fallback)
    Query-string tokens (?token=...) are deliberately rejected so JWTs never leak
    into CloudFront/S3 access logs, browser history, or Referer headers.
    """
    if credentials and credentials.credentials:
        return credentials.credentials
    if access_token:
        return access_token
    if request and request.cookies.get("access_token"):
        return request.cookies.get("access_token")
    return None


def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    access_token: Optional[str] = Cookie(None),
    db: Session = Depends(get_db),
) -> User:
    token_str = _extract_token(request, credentials, access_token)
    if not token_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = _get_user_from_token_str(token_str, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or session revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def get_current_user_optional(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    access_token: Optional[str] = Cookie(None),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Optional authentication: returns active User if authenticated, else None."""
    token_str = _extract_token(request, credentials, access_token)
    if not token_str:
        return None
    return _get_user_from_token_str(token_str, db)


def is_owner(user: User) -> bool:
    role_val = user.role.value if hasattr(user.role, "value") else str(user.role)
    return role_val.upper() == UserRole.OWNER.value


def require_owner(current_user: User = Depends(get_current_user)) -> User:
    if not is_owner(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Owner access required",
        )
    return current_user
