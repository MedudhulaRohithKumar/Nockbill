"""
Google Cloud Vision provider.
Set OCR_PROVIDER=google_vision in .env and provide
GOOGLE_APPLICATION_CREDENTIALS path.
"""
import io
from PIL import Image
from app.ocr.base import OCRProvider


class GoogleVisionProvider(OCRProvider):

    def __init__(self):
        try:
            from google.cloud import vision
            self._client = vision.ImageAnnotatorClient()
            self._vision = vision
        except ImportError:
            raise RuntimeError(
                "google-cloud-vision not installed. "
                "Run: pip install google-cloud-vision"
            )

    def extract_text(self, image: Image.Image) -> str:
        buf = io.BytesIO()
        image.save(buf, format="JPEG")
        content = buf.getvalue()
        gv_image = self._vision.Image(content=content)
        response = self._client.text_detection(image=gv_image)
        if response.error.message:
            raise RuntimeError(f"Google Vision error: {response.error.message}")
        texts = response.text_annotations
        return texts[0].description if texts else ""
