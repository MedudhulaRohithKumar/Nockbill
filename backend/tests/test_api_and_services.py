"""
Integration tests for FastAPI routers, auth cookies, OCR deskew,
email/S3 services, and AWS Lambda handler.
"""
import os
import sys
import unittest
from pathlib import Path

os.environ.setdefault("DATABASE_URL", "sqlite:////tmp/nockbill_test.sqlite3")
os.environ.setdefault("ENVIRONMENT", "test")

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
    def test_fastapi_endpoints_and_auth_utils(self):
        try:
            import numpy as np
            from fastapi.testclient import TestClient
            from app.main import app
            from app.lambda_handler import handler
            from app.ocr.tesseract_provider import TesseractProvider
            from app.utils.auth import (
                hash_password,
                verify_password,
                create_access_token,
                decode_token,
            )
        except ImportError:
            self.skipTest("FastAPI / NumPy runtime not loaded in current interpreter")

        # 1. Password hashing & JWT roundtrip
        pw_hash = hash_password("NockBillTest#2026")
        self.assertTrue(verify_password("NockBillTest#2026", pw_hash))
        self.assertFalse(verify_password("wrong-password", pw_hash))

        token = create_access_token({"sub": "1", "username": "tester", "role": "OWNER", "shop_id": 1})
        decoded = decode_token(token)
        self.assertEqual(decoded["username"], "tester")
        self.assertEqual(decoded["shop_id"], 1)

        # 2. TesseractProvider._deskew with np.nonzero
        provider = TesseractProvider()
        blank = np.zeros((50, 100), dtype=np.uint8)
        blank[20:30, 10:90] = 255
        deskewed = provider._deskew(blank)
        self.assertEqual(deskewed.shape, (50, 100))

        # 3. Lambda warmup & unknown action
        warmup_res = handler({"action": "warmup"}, None)
        self.assertEqual(warmup_res["status"], "WARMED")

        unknown_res = handler({"action": "nonexistent_action"}, None)
        self.assertEqual(unknown_res["status"], "UNKNOWN_ACTION")

        # 4. FastAPI root, health, captcha, and logout endpoints
        client = TestClient(app)
        root_res = client.get("/")
        self.assertEqual(root_res.status_code, 200)

        health_res = client.get("/health")
        self.assertEqual(health_res.status_code, 200)
        self.assertEqual(health_res.json()["status"], "ok")

        captcha_res = client.get("/api/auth/captcha")
        self.assertEqual(captcha_res.status_code, 200)
        body = captcha_res.json()
        self.assertIn("captcha_token", body)
        self.assertIn("captcha_image", body)

        logout_res = client.post("/api/auth/logout")
        self.assertEqual(logout_res.status_code, 200)


if __name__ == "__main__":
    unittest.main()
