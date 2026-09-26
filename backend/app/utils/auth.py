from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.config.settings import settings
from app.database.base import get_db
from app.models.models import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer()


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
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    payload = decode_token(credentials.credentials)
    sub = payload.get("sub")
    user_id = payload.get("user_id")
    if not sub and not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    user = None
    # Try by numeric ID
    target_id = user_id or sub
    try:
        uid = int(target_id)
        user = db.query(User).filter(User.id == uid, User.is_active == True).first()
    except (ValueError, TypeError):
        pass

    # Fallback to query by username if not found by ID
    if not user and sub:
        user = db.query(User).filter(User.username == str(sub), User.is_active == True).first()

    if not user:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


def require_owner(current_user: User = Depends(get_current_user)) -> User:
    from app.models.models import UserRole
    if current_user.role != UserRole.OWNER:
        raise HTTPException(status_code=403, detail="Owner access required")
    return current_user
