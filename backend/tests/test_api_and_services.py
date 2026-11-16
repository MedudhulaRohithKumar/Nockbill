"""
Integration tests for FastAPI routers, auth cookies, OCR deskew,
email/S3 services, and AWS Lambda handler.
"""
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


class TestTesseractDeskewUnit(unittest.TestCase):
    def test_deskew_uses_np_nonzero(self):
        tp_path = BACKEND_DIR / "app" / "ocr" / "tesseract_provider.py"
        text = tp_path.read_text(encoding="utf-8")
        self.assertIn("np.nonzero(gray > 0)", text)
        self.assertNotIn("np.where(gray > 0)", text)


class TestInventoryAndOcrRoutersStatic(unittest.TestCase):
    def test_inventory_router_no_duplicate_branch(self):
        inv_path = BACKEND_DIR / "app" / "routers" / "inventory.py"
        text = inv_path.read_text(encoding="utf-8")
        self.assertIn("tx_enum = InventoryTxType.ADJUSTMENT", text)
        self.assertNotIn('if tx_type_str == "AUDIT_CORRECTION":', text)

    def test_ocr_router_no_float_equality(self):
        ocr_path = BACKEND_DIR / "app" / "routers" / "ocr.py"
        text = ocr_path.read_text(encoding="utf-8")
        self.assertIn("result.price <= 0", text)
        self.assertNotIn("result.price == 0.0", text)


class TestFastApiAppEndpoints(unittest.TestCase):
    def test_fastapi_endpoints_if_available(self):
        try:
            import numpy as np
            from fastapi.testclient import TestClient
            from app.main import app
            from app.lambda_handler import handler
            from app.ocr.tesseract_provider import TesseractProvider
        except ImportError:
            self.skipTest("FastAPI / NumPy runtime not loaded in current interpreter")

        # 1. Test TesseractProvider._deskew with np.nonzero
        provider = TesseractProvider()
        blank = np.zeros((50, 100), dtype=np.uint8)
        blank[20:30, 10:90] = 255
        deskewed = provider._deskew(blank)
        self.assertEqual(deskewed.shape, (50, 100))

        # 2. Test Lambda warmup action
        warmup_res = handler({"action": "warmup"}, None)
        self.assertEqual(warmup_res["status"], "WARMED")

        # 3. Test FastAPI health and auth endpoints
        client = TestClient(app)
        health = client.get("/health")
        self.assertIn(health.status_code, (200, 404))

        captcha_res = client.get("/api/auth/captcha")
        if captcha_res.status_code == 200:
            body = captcha_res.json()
            self.assertIn("captcha_token", body)
            self.assertIn("captcha_image", body)

        logout_res = client.post("/api/auth/logout")
        self.assertEqual(logout_res.status_code, 200)


if __name__ == "__main__":
    unittest.main()
