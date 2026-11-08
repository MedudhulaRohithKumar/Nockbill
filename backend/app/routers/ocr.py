import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.database.base import get_db
from app.models.models import Product, User
from app.schemas.schemas import OcrResult
from app.ocr.factory import get_ocr_provider
from app.ocr.ocr_service import extract_product_details
from app.utils.auth import get_current_user
from app.config.settings import settings

router = APIRouter(prefix="/api/ocr", tags=["OCR"])

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff"}
MAX_SIZE_BYTES = settings.max_image_size_mb * 1024 * 1024


@router.post("/extract", response_model=OcrResult)
async def extract_from_image(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Validate extension
    ext = os.path.splitext(file.filename or "image.jpg")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            400,
            f"Unsupported file type '{ext}'. "
            f"Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Read & validate size
    image_bytes = await file.read()
    if len(image_bytes) > MAX_SIZE_BYTES:
        raise HTTPException(
            413,
            f"Image too large. Maximum {settings.max_image_size_mb}MB allowed.",
        )

    try:
        provider = get_ocr_provider()
        raw_text = provider.extract(image_bytes)
    except Exception as e:
        raise HTTPException(
            422,
            f"OCR processing failed: {str(e)}. "
            "Please retake the photo with better lighting.",
        )

    if not raw_text or not raw_text.strip():
        raise HTTPException(
            422,
            "Unable to read the product label. "
            "Please retake the photo with better lighting.",
        )

    result = extract_product_details(raw_text)

    # ── Check if product already exists in inventory ──────────
    matched = None
    if result.product_name:
        # Search by full name or first significant keyword
        words = [w for w in result.product_name.split() if len(w) >= 3]
        search_term = words[0] if words else result.product_name
        search = f"%{search_term}%"
        candidates = (
            db.query(Product)
            .filter(
                Product.shop_id == current_user.shop_id,
                or_(
                    Product.product_name.ilike(search),
                    Product.company_name.ilike(search)
                ),
                Product.is_active == True
            )
            .limit(5)
            .all()
        )
        if candidates:
            matched = candidates[0]  # best match

    if matched:
        from app.schemas.schemas import ProductResponse
        result.matched_product = ProductResponse.model_validate(matched)
        if not result.price or result.price == 0.0:
            result.price = float(matched.selling_price) if matched.selling_price else 0.0
        if not result.selling_price:
            result.selling_price = float(matched.selling_price) if matched.selling_price else 0.0
        if not result.cost_price and matched.cost_price:
            result.cost_price = float(matched.cost_price)
        if matched.hsn_code:
            result.hsn_code = matched.hsn_code
        if matched.gst_rate:
            result.gst_rate = float(matched.gst_rate)

    return result

