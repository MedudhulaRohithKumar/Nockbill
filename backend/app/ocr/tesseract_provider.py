"""
Tesseract OCR provider (free, local, works offline).
Requires: tesseract binary installed on the system.
Install: https://github.com/UB-Mannheim/tesseract/wiki (Windows)
"""
import pytesseract
from PIL import Image, ImageFilter, ImageEnhance
import cv2
import numpy as np
from app.ocr.base import OCRProvider
from app.config.settings import settings


class TesseractProvider(OCRProvider):

    def __init__(self):
        if settings.tesseract_cmd and settings.tesseract_cmd != "tesseract":
            pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd

    def extract_text(self, image: Image.Image) -> str:
        # Enhanced preprocessing for better accuracy on product labels
        image = self._enhance_for_ocr(image)
        # Use PSM 3 (auto page segmentation) with English + Hindi if available
        config = "--psm 3 --oem 3"
        try:
            text = pytesseract.image_to_string(image, lang="eng", config=config)
        except Exception:
            text = pytesseract.image_to_string(image, config=config)
        return text

    def _enhance_for_ocr(self, image: Image.Image) -> Image.Image:
        """Convert to OpenCV, enhance, return PIL image."""
        # PIL -> numpy
        img_np = np.array(image)

        # Convert to grayscale
        if len(img_np.shape) == 3:
            gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)
        else:
            gray = img_np

        # Deskew
        gray = self._deskew(gray)

        # Adaptive threshold to handle varying lighting
        processed = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY, 11, 2
        )

        # Remove noise
        processed = cv2.medianBlur(processed, 3)

        # Scale up small images for better accuracy
        h, w = processed.shape
        if h < 800:
            scale = 800 / h
            processed = cv2.resize(
                processed, (int(w * scale), int(h * scale)),
                interpolation=cv2.INTER_CUBIC
            )

        return Image.fromarray(processed)

    def _deskew(self, gray: np.ndarray) -> np.ndarray:
        """Attempt to correct image skew."""
        try:
            coords = np.column_stack(np.where(gray > 0))
            angle = cv2.minAreaRect(coords)[-1]
            if angle < -45:
                angle = -(90 + angle)
            else:
                angle = -angle
            if abs(angle) < 0.5:
                return gray
            h, w = gray.shape
            M = cv2.getRotationMatrix2D((w // 2, h // 2), angle, 1.0)
            rotated = cv2.warpAffine(
                gray, M, (w, h),
                flags=cv2.INTER_CUBIC,
                borderMode=cv2.BORDER_REPLICATE
            )
            return rotated
        except Exception:
            return gray
