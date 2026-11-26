import base64
from io import BytesIO
from pathlib import Path
from decimal import Decimal, InvalidOperation
from typing import Optional
from urllib.parse import quote
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from PIL import Image, UnidentifiedImageError
from reportlab.graphics import renderSVG
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from sqlalchemy.orm import Session
from app.config.settings import settings
from app.database.base import get_db
from app.models.models import ShopSettings, AuditLog, AuditAction, User
from app.schemas.schemas import ShopSettingsUpdate, ShopSettingsResponse
from app.reports.ledger_pdfs import generate_thermal_test_slip_pdf, generate_upi_standee_pdf
from app.utils.auth import get_current_user, require_owner

router = APIRouter(prefix="/api/settings", tags=["Settings"])

_MAX_LOGO_UPLOAD_BYTES = 2 * 1024 * 1024  # 2 MB


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


def _bool_or_default(shop: ShopSettings, attr: str, default: bool = True) -> bool:
    val = getattr(shop, attr, None)
    return default if val is None else bool(val)


def _serialize_settings(shop: ShopSettings) -> dict:
    """Serialize all shop settings fields to dict, including optional ones."""
    def _g(attr):
        return getattr(shop, attr, None)

    return {
        "id": shop.id,
        "shop_account_id": f"SHOP-{int(shop.id):05d}" if shop.id else "SHOP-00001",
        "shop_name": shop.shop_name or "My Shop",
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
        "invoice_template": _g("invoice_template") or "CLASSIC_GST",
        "invoice_accent_color": _g("invoice_accent_color") or "#15803d",
        "invoice_header_tagline": _g("invoice_header_tagline"),
        "invoice_footer_note": _g("invoice_footer_note") or "Thank you for your business! Visit again.",
        "invoice_signature_label": _g("invoice_signature_label") or "Authorized Signatory",
        "invoice_show_logo": _bool_or_default(shop, "invoice_show_logo", True),
        "invoice_show_licenses": _bool_or_default(shop, "invoice_show_licenses", True),
        "invoice_show_bank_details": _bool_or_default(shop, "invoice_show_bank_details", True),
        "invoice_show_batch_expiry": _bool_or_default(shop, "invoice_show_batch_expiry", True),
        "invoice_show_hsn": _bool_or_default(shop, "invoice_show_hsn", True),
        "subscription_status": _g("subscription_status") or "TRIAL",
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
    current_user: User = Depends(require_owner),
):
    shop = _get_or_create_settings(db, current_user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        if field == "logo_path" and value is not None:
            raw_logo = str(value).strip()
            if raw_logo and not (
                raw_logo.startswith("data:image/png;base64,")
                or raw_logo.startswith("data:image/jpeg;base64,")
                or raw_logo.startswith("data:image/webp;base64,")
                or raw_logo.startswith(f"/uploads/shop_{shop.id}_")
            ):
                raise HTTPException(status_code=400, detail="Invalid logo image format.")
            if len(raw_logo) > 700_000:
                raise HTTPException(status_code=400, detail="Logo image is too large (max 500 KB).")
        if hasattr(shop, field):
            setattr(shop, field, value)
    db.add(AuditLog(
        user_id=current_user.id,
        shop_id=shop.id,
        action=AuditAction.SETTINGS_UPDATE,
        reference_type="ShopSettings",
    ))
    db.commit()
    db.refresh(shop)
    return _serialize_settings(shop)


@router.post("/logo")
async def upload_shop_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    """Validate, resize, and persist a tenant-isolated shop logo for invoices (Lambda-safe data URI + upload file)."""
    raw_bytes = await file.read(_MAX_LOGO_UPLOAD_BYTES + 1)
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Empty logo file.")
    if len(raw_bytes) > _MAX_LOGO_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Logo file exceeds 2 MB limit.")

    try:
        with Image.open(BytesIO(raw_bytes)) as verify_img:
            verify_img.verify()
        with Image.open(BytesIO(raw_bytes)) as img:
            converted = img.convert("RGBA") if img.mode in ("RGBA", "LA", "P") else img.convert("RGB")
            converted.thumbnail((360, 160))
            out_buf = BytesIO()
            converted.save(out_buf, format="PNG", optimize=True)
            png_bytes = out_buf.getvalue()
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(status_code=422, detail="Invalid image file. Upload a valid PNG, JPEG, or WebP logo.")

    shop = _get_or_create_settings(db, current_user)
    try:
        upload_root = Path(settings.upload_dir)
        upload_root.mkdir(parents=True, exist_ok=True)
        (upload_root / f"shop_{shop.id}_logo.png").write_bytes(png_bytes)
    except OSError:
        pass

    b64_str = base64.b64encode(png_bytes).decode("ascii")
    shop.logo_path = f"data:image/png;base64,{b64_str}"
    db.add(AuditLog(
        user_id=current_user.id,
        shop_id=shop.id,
        action=AuditAction.SETTINGS_UPDATE,
        reference_type="ShopSettings",
        description="Updated shop invoice logo",
    ))
    db.commit()
    db.refresh(shop)
    return _serialize_settings(shop)


@router.delete("/logo")
def delete_shop_logo(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    """Remove the current shop invoice logo."""
    shop = _get_or_create_settings(db, current_user)
    shop.logo_path = None
    db.add(AuditLog(
        user_id=current_user.id,
        shop_id=shop.id,
        action=AuditAction.SETTINGS_UPDATE,
        reference_type="ShopSettings",
        description="Removed shop invoice logo",
    ))
    db.commit()
    db.refresh(shop)
    return _serialize_settings(shop)


def build_upi_qr_payload(
    upi_id: str,
    shop_name: str,
    amount: Optional[float] = None,
    invoice_number: Optional[str] = None,
) -> dict:
    clean_vpa = (upi_id or "").strip()
    clean_name = (shop_name or "NockBill Shop").strip()[:80]
    params = [
        f"pa={quote(clean_vpa, safe='@._-')}",
        f"pn={quote(clean_name)}",
    ]
    if amount is not None:
        try:
            dec_amt = Decimal(str(amount)).quantize(Decimal("0.01"))
            if dec_amt > Decimal("0"):
                params.append(f"am={dec_amt}")
        except (InvalidOperation, ValueError):
            pass
    if invoice_number and invoice_number.strip():
        params.append(f"tn={quote(invoice_number.strip()[:50])}")
    params.append("cu=INR")
    upi_uri = f"upi://pay?{'&'.join(params)}"

    qr_widget = QrCodeWidget(upi_uri)
    bounds = qr_widget.getBounds()
    width = max(bounds[2] - bounds[0], 1.0)
    height = max(bounds[3] - bounds[1], 1.0)
    drawing = Drawing(160, 160, transform=[160.0 / width, 0, 0, 160.0 / height, 0, 0])
    drawing.add(qr_widget)
    raw_svg = renderSVG.drawToString(drawing)
    svg_bytes = raw_svg.encode("utf-8") if isinstance(raw_svg, str) else raw_svg
    svg_data_uri = f"data:image/svg+xml;base64,{base64.b64encode(svg_bytes).decode('ascii')}"
    return {
        "upi_id": clean_vpa,
        "shop_name": clean_name,
        "upi_uri": upi_uri,
        "qr_svg_data_uri": svg_data_uri,
    }


@router.get("/upi-qr")
def get_dynamic_upi_qr(
    amount: Optional[float] = Query(default=None, ge=0),
    invoice_number: Optional[str] = Query(default=None, max_length=64),
    upi_id: Optional[str] = Query(default=None, max_length=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a scannable Dynamic UPI QR code SVG for POS checkout and printed invoices."""
    shop = _get_or_create_settings(db, current_user)
    effective_vpa = (upi_id or shop.upi_id or "").strip()
    if not effective_vpa:
        raise HTTPException(
            status_code=400,
            detail="Shop UPI ID is not configured. Add your UPI VPA under Shop Management → General Shop Settings.",
        )
    return build_upi_qr_payload(
        upi_id=effective_vpa,
        shop_name=shop.shop_name or "My Shop",
        amount=amount,
        invoice_number=invoice_number,
    )


@router.get("/test-slip.pdf")
def download_thermal_test_slip_pdf(
    port: str = Query(default="USB001 (80mm Direct Thermal)", max_length=80),
    inline: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a standalone 80mm thermal printer calibration slip PDF."""
    shop = _get_or_create_settings(db, current_user)
    pdf_bytes = generate_thermal_test_slip_pdf(shop, printer_port=port)
    disp = "inline" if inline else "attachment"
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'{disp}; filename="ESC_POS_80mm_Test_Slip.pdf"'},
    )


@router.get("/upi-standee.pdf")
def download_upi_standee_pdf(
    inline: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a printable counter-top Merchant UPI QR Standee PDF."""
    shop = _get_or_create_settings(db, current_user)
    pdf_bytes = generate_upi_standee_pdf(shop)
    disp = "inline" if inline else "attachment"
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'{disp}; filename="Merchant_UPI_Standee.pdf"'},
    )


def serve_tenant_upload(filename: str, db: Session, current_user: User) -> FileResponse:
    """
    Serve an uploaded file strictly to authenticated users whose shop owns that file (M1).
    Prevents path traversal and cross-tenant logo/document access.
    """
    clean_name = Path(filename).name
    if not clean_name or clean_name != filename or clean_name.startswith("."):
        raise HTTPException(status_code=400, detail="Invalid file name")

    shop_id = getattr(current_user, "shop_id", None)
    shop = db.query(ShopSettings).filter(ShopSettings.id == shop_id).first() if shop_id else None
    allowed_names = set()
    if shop and shop.logo_path and not str(shop.logo_path).startswith("data:"):
        allowed_names.add(Path(shop.logo_path).name)
    is_shop_prefixed = shop_id is not None and clean_name.startswith(f"shop_{shop_id}_")

    if clean_name not in allowed_names and not is_shop_prefixed:
        raise HTTPException(status_code=404, detail="File not found")

    upload_root = Path(settings.upload_dir).resolve()
    target_path = (upload_root / clean_name).resolve()
    if upload_root not in target_path.parents or not target_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        path=str(target_path),
        headers={"Cache-Control": "private, max-age=3600"},
    )
