import io
import logging
import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from PIL import Image, UnidentifiedImageError
from sqlalchemy import or_
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.config.settings import settings
from app.database.base import get_db
from app.models.models import Product, User
from app.ocr.factory import get_ocr_provider
from app.ocr.ocr_service import extract_product_details
from app.schemas.schemas import OcrResult
from app.utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ocr", tags=["OCR"])

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff"}
ALLOWED_IMAGE_FORMATS = {"JPEG", "PNG", "WEBP", "BMP", "TIFF"}
MAX_SIZE_BYTES = settings.max_image_size_mb * 1024 * 1024
MAX_OCR_IMAGE_PIXELS = 25_000_000  # Defend against decompression bombs (M2)

Image.MAX_IMAGE_PIXELS = MAX_OCR_IMAGE_PIXELS


def _validate_image_payload(image_bytes: bytes) -> None:
    """Validate actual image magic bytes and pixel bounds via Pillow (M2)."""
    if not image_bytes:
        raise HTTPException(400, "Uploaded image file is empty.")
    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            fmt = (img.format or "").upper()
            if fmt not in ALLOWED_IMAGE_FORMATS:
                raise HTTPException(400, "Uploaded file is not a supported image format.")
            img.verify()
    except HTTPException:
        raise
    except Image.DecompressionBombError:
        raise HTTPException(413, "Image resolution exceeds safe processing limits.")
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(400, "Invalid or corrupted image file.")


@router.post("/extract", response_model=OcrResult)
async def extract_from_image(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ext = os.path.splitext(file.filename or "image.jpg")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            400,
            f"Unsupported file type '{ext}'. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    # Bounded read prevents buffering arbitrarily large payloads into Lambda RAM (M2)
    image_bytes = await file.read(MAX_SIZE_BYTES + 1)
    if len(image_bytes) > MAX_SIZE_BYTES:
        raise HTTPException(
            413,
            f"Image too large. Maximum {settings.max_image_size_mb}MB allowed.",
        )

    await run_in_threadpool(_validate_image_payload, image_bytes)

    try:
        provider = get_ocr_provider()
        # Offload CPU-heavy OpenCV/Tesseract work from the async event loop (B7)
        raw_text = await run_in_threadpool(provider.extract, image_bytes)
    except Exception:
        logger.exception("OCR extraction failed for shop_id=%s", current_user.shop_id)
        raise HTTPException(
            422,
            "OCR processing failed. Please retake the photo with better lighting.",
        )

    if not raw_text or not raw_text.strip():
        raise HTTPException(
            422,
            "Unable to read the product label. Please retake the photo with better lighting.",
        )

    result = extract_product_details(raw_text)

    matched = None
    if result.product_name:
        words = [w for w in result.product_name.split() if len(w) >= 3]
        search_term = words[0] if words else result.product_name
        search = f"%{search_term}%"
        candidates = (
            db.query(Product)
            .filter(
                Product.shop_id == current_user.shop_id,
                or_(
                    Product.product_name.ilike(search),
                    Product.company_name.ilike(search),
                ),
                Product.is_active == True,
            )
            .limit(5)
            .all()
        )
        if candidates:
            matched = candidates[0]

    if matched:
        from app.schemas.schemas import ProductResponse
        result.matched_product = ProductResponse.model_validate(matched)
        if not result.price or result.price <= 0:
            result.price = float(matched.selling_price) if matched.selling_price else 0.0
        if not result.selling_price:
            result.selling_price = float(matched.selling_price) if matched.selling_price else 0.0
        matched_cost = getattr(matched, "purchase_price", None)
        if not result.cost_price and matched_cost:
            result.cost_price = float(matched_cost)
        if matched.hsn_code:
            result.hsn_code = matched.hsn_code
        if matched.gst_rate:
            result.gst_rate = float(matched.gst_rate)

    return result
