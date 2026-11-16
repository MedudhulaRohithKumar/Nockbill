# ocr package
from app.ocr.ocr_service import extract_product_details
try:
    from app.ocr.factory import get_ocr_provider
except ImportError:
    pass
