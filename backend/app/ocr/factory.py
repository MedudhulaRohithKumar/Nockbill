"""
OCR factory — instantiates the correct provider based on settings and environment.
Defaults to RapidOCR (fast, offline ONNX OCR engine) for maximum accuracy on product labels.
"""
from app.config.settings import settings
from app.ocr.base import OCRProvider

_provider_instance: OCRProvider = None


def get_ocr_provider() -> OCRProvider:
    global _provider_instance
    if _provider_instance is not None:
        return _provider_instance

    name = settings.ocr_provider.lower() if hasattr(settings, "ocr_provider") and settings.ocr_provider else "rapidocr"

    # 1. Try RapidOCR Provider (Primary)
    try:
        from app.ocr.rapidocr_provider import RapidOCRProvider
        provider = RapidOCRProvider()
        if provider.engine is not None:
            _provider_instance = provider
            print("[OCR Factory] Successfully loaded RapidOCR provider")
            return _provider_instance
    except Exception as e:
        print(f"[OCR Factory] RapidOCR load failed, trying fallback: {e}")

    # 2. Try Tesseract Provider if configured
    try:
        from app.ocr.tesseract_provider import TesseractProvider
        _provider_instance = TesseractProvider()
        print("[OCR Factory] Loaded Tesseract provider")
        return _provider_instance
    except Exception as e:
        print(f"[OCR Factory] Tesseract load failed: {e}")

    # 3. Google Vision if configured
    if name == "google_vision":
        from app.ocr.google_vision_provider import GoogleVisionProvider
        _provider_instance = GoogleVisionProvider()
        return _provider_instance

    # Fallback to RapidOCRProvider
    from app.ocr.rapidocr_provider import RapidOCRProvider
    _provider_instance = RapidOCRProvider()
    return _provider_instance
