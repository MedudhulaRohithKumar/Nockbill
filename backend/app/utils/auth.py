from datetime import datetime, timedelta
from typing import Optional
import jwt
from jwt.exceptions import PyJWTError, InvalidTokenError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status, Query
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
    expire = datetime.utcnow() + (
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
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    token: Optional[str] = Query(None, description="Auth token via query parameter"),
    db: Session = Depends(get_db),
) -> User:
    """Strict authentication: checks Authorization Bearer header or ?token= query parameter."""
    token_str = None
    if credentials and credentials.credentials:
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
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    token: Optional[str] = Query(None, description="Auth token via query parameter"),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Optional authentication: returns active User if authenticated, else None without 401 error."""
    token_str = None
    if credentials and credentials.credentials:
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
