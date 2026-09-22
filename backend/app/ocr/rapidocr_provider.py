"""
RapidOCR provider using ONNX Runtime (fast, 100% offline OCR).
Does not require external binaries like Tesseract.
"""
from PIL import Image
import numpy as np
from app.ocr.base import OCRProvider


class RapidOCRProvider(OCRProvider):
    def __init__(self):
        self.engine = None
        try:
            from rapidocr_onnxruntime import RapidOCR
            self.engine = RapidOCR()
        except Exception as e:
            print(f"[RapidOCR] Initialization note: {e}")

    def extract_text(self, image: Image.Image) -> str:
        if self.engine is None:
            from rapidocr_onnxruntime import RapidOCR
            self.engine = RapidOCR()

        img_np = np.array(image)
        result, elapsed_time = self.engine(img_np)

        if not result:
            return ""

        # result is a list of [box, text, score]
        extracted_lines = []
        for line_item in result:
            if len(line_item) >= 2 and line_item[1]:
                extracted_lines.append(str(line_item[1]).strip())

        return "\n".join(extracted_lines)
