from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.base import get_db
from app.models.models import ShopSettings, AuditLog, AuditAction, User
from app.schemas.schemas import ShopSettingsUpdate, ShopSettingsResponse
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/settings", tags=["Settings"])


def _get_or_create_settings(db: Session) -> ShopSettings:
    shop = db.query(ShopSettings).first()
    if not shop:
        shop = ShopSettings()
        db.add(shop)
        db.commit()
        db.refresh(shop)
    return shop


@router.get("", response_model=ShopSettingsResponse)
def get_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_or_create_settings(db)


@router.put("", response_model=ShopSettingsResponse)
def update_settings(
    payload: ShopSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop = _get_or_create_settings(db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(shop, field, value)
    db.add(AuditLog(
        user_id=current_user.id, action=AuditAction.SETTINGS_UPDATE,
        reference_type="ShopSettings",
    ))
    db.commit()
    db.refresh(shop)
    return shop
