"""
Abstract base class for OCR providers.
All providers must implement `extract(image_bytes) -> dict`.
"""
from abc import ABC, abstractmethod
from typing import Optional
from PIL import Image
import io


class OCRProvider(ABC):
    """Pluggable OCR provider interface."""

    @abstractmethod
    def extract_text(self, image: Image.Image) -> str:
        """Return raw extracted text from image."""
        ...

    def extract(self, image_bytes: bytes) -> str:
        """Pre-process image then extract text."""
        image = self._preprocess(image_bytes)
        return self.extract_text(image)

    def _preprocess(self, image_bytes: bytes) -> Image.Image:
        """
        Basic image pre-processing:
        1. Open and convert to RGB
        2. Auto-rotate via EXIF
        3. Resize if too large (keeps aspect ratio)
        """
        import struct
        image = Image.open(io.BytesIO(image_bytes))

        # Auto-rotate based on EXIF orientation
        try:
            from PIL import ImageOps
            image = ImageOps.exif_transpose(image)
        except Exception:
            pass

        # Convert to RGB
        if image.mode not in ("RGB", "L"):
            image = image.convert("RGB")

        # Resize if too large (cap at 2000px on longest side)
        max_dim = 2000
        w, h = image.size
        if max(w, h) > max_dim:
            scale = max_dim / max(w, h)
            image = image.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

        return image
