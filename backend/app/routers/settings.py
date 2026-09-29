from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.base import get_db
from app.models.models import ShopSettings, AuditLog, AuditAction, User
from app.schemas.schemas import ShopSettingsUpdate, ShopSettingsResponse
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/settings", tags=["Settings"])


def _get_or_create_settings(db: Session, current_user: User) -> ShopSettings:
    shop_id = getattr(current_user, "shop_id", 1) or 1
    shop = db.query(ShopSettings).filter(ShopSettings.id == shop_id).first()
    if not shop:
        shop = ShopSettings(shop_name=f"{current_user.name}'s Shop")
        db.add(shop)
        db.commit()
        db.refresh(shop)
        current_user.shop_id = shop.id
        db.commit()
    return shop


def _serialize_settings(shop: ShopSettings) -> dict:
    """Serialize all shop settings fields to dict, including optional ones."""
    def _g(attr):
        return getattr(shop, attr, None)

    return {
        "id": shop.id,
        "shop_name": shop.shop_name or "My Fertilizer Shop",
        "proprietor_name": _g("proprietor_name"),
        "address": _g("address"),
        "address_line1": _g("address_line1"),
        "address_line2": _g("address_line2"),
        "city": _g("city"),
        "state": _g("state"),
        "pincode": _g("pincode"),
        "phone": _g("phone"),
        "email": _g("email"),
        "gstin": _g("gstin"),
        "fertilizer_license_no": _g("fertilizer_license_no"),
        "pesticide_license_no": _g("pesticide_license_no"),
        "seed_license_no": _g("seed_license_no"),
        "bank_name": _g("bank_name"),
        "bank_account_no": _g("bank_account_no"),
        "bank_ifsc": _g("bank_ifsc"),
        "bank_branch": _g("bank_branch"),
        "upi_id": _g("upi_id"),
        "invoice_prefix": shop.invoice_prefix or "INV",
        "invoice_counter": shop.invoice_counter or 1,
        "default_gst_rate": float(shop.default_gst_rate or 18),
        "currency": shop.currency or "INR",
        "thermal_print": bool(shop.thermal_print),
        "logo_path": _g("logo_path"),
        "terms_conditions": _g("terms_conditions"),
    }


@router.get("")
def get_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop = _get_or_create_settings(db, current_user)
    return _serialize_settings(shop)


@router.put("")
def update_settings(
    payload: ShopSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop = _get_or_create_settings(db, current_user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        if hasattr(shop, field):
            setattr(shop, field, value)
    db.add(AuditLog(
        user_id=current_user.id, action=AuditAction.SETTINGS_UPDATE,
        reference_type="ShopSettings",
    ))
    db.commit()
    db.refresh(shop)
    return _serialize_settings(shop)
