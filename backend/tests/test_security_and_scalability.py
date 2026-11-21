"""
Comprehensive unit & integration test suite verifying every Security Review (C1-C5, H1-H5, M1-M6)
and System Design Bottleneck (B1-B12) remediation.
"""
import hashlib
import hmac
import io
import json
import os
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from unittest.mock import MagicMock, patch

os.environ["DATABASE_URL"] = "sqlite:////tmp/nockbill_security_test.sqlite3"
os.environ["ENVIRONMENT"] = "development"
os.environ["DEBUG"] = "true"
os.environ["AUTO_MIGRATE_ON_STARTUP"] = "true"
os.environ["ALLOWED_ORIGINS"] = "http://localhost:5173,https://nockbill.com"

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config.secrets import SecretResolutionError, build_database_url_from_secret
from app.config.settings import settings
from app.database.base import Base, get_db
from app.database.migrations import ensure_schema
from app.main import app
from app.models.models import (
    AuditLog,
    Expense,
    ExpenseCategory,
    Product,
    ProductBatch,
    ProductVariant,
    RateLimitEvent,
    Sale,
    SaleItem,
    ShopSettings,
    UsedCaptchaNonce,
    User,
    UserRole,
)
from app.utils.auth import create_access_token, hash_password, verify_password
from app.utils.captcha import _FALLBACK_USED_NONCES, _compute_signature, generate_captcha_challenge, verify_captcha_challenge
from app.utils.errors import internal_server_error


def _make_signed_captcha(code: str = "AB23CD", nonce: str = "a1b2c3d4e5f60718293a4b5c6d7e8f90", expires_offset: int = 300) -> tuple[str, str]:
    import time
    expires_at = int(time.time()) + expires_offset
    sig = _compute_signature(nonce, expires_at, code)
    return f"{nonce}.{expires_at}.{sig}", code


def _make_valid_png_bytes() -> bytes:
    img = Image.new("RGB", (64, 64), (255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


class TestSecurityAndScalabilitySuite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._tmpdir = tempfile.TemporaryDirectory()
        cls.db_path = Path(cls._tmpdir.name) / "test_sec.sqlite3"
        cls.upload_dir = Path(cls._tmpdir.name) / "uploads"
        cls.upload_dir.mkdir(parents=True, exist_ok=True)
        cls.engine = create_engine(
            f"sqlite:///{cls.db_path}",
            connect_args={"check_same_thread": False},
        )
        cls.TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=cls.engine)
        ensure_schema(cls.engine, raise_on_error=True)

        def override_get_db():
            db = cls.TestingSessionLocal()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        cls._orig_upload_dir = settings.upload_dir
        settings.upload_dir = str(cls.upload_dir)
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.clear()
        settings.upload_dir = cls._orig_upload_dir
        cls.engine.dispose()
        cls._tmpdir.cleanup()

    def setUp(self):
        Base.metadata.drop_all(bind=self.engine)
        ensure_schema(self.engine, raise_on_error=True)
        _FALLBACK_USED_NONCES.clear()

        db = self.TestingSessionLocal()
        try:
            self.shop_a = ShopSettings(
                shop_name="Alpha Agro",
                email="alpha@example.com",
                invoice_prefix="ALP",
                invoice_counter=1,
                logo_path="shop_1_logo.png",
                subscription_status="PENDING",
            )
            self.shop_b = ShopSettings(
                shop_name="Beta Agro",
                email="beta@example.com",
                invoice_prefix="BET",
                invoice_counter=1,
                logo_path="shop_2_logo.png",
                subscription_status="ACTIVE",
            )
            db.add_all([self.shop_a, self.shop_b])
            db.flush()

            self.owner_a = User(
                name="Alice Owner",
                username="owner_a",
                email="alice@alpha.example",
                password_hash=hash_password("AlphaPass#1"),
                role=UserRole.OWNER,
                shop_id=self.shop_a.id,
                subscription_status="PENDING",
                is_active=True,
            )
            self.staff_a = User(
                name="Sam Staff",
                username="staff_a",
                email="sam@alpha.example",
                password_hash=hash_password("StaffPass#1"),
                role=UserRole.STAFF,
                shop_id=self.shop_a.id,
                subscription_status="ACTIVE",
                is_active=True,
            )
            self.owner_b = User(
                name="Bob Owner",
                username="owner_b",
                email="bob@beta.example",
                password_hash=hash_password("BetaPass#1"),
                role=UserRole.OWNER,
                shop_id=self.shop_b.id,
                subscription_status="ACTIVE",
                is_active=True,
            )
            db.add_all([self.owner_a, self.staff_a, self.owner_b])
            db.commit()
            db.refresh(self.shop_a)
            db.refresh(self.shop_b)
            db.refresh(self.owner_a)
            db.refresh(self.staff_a)
            db.refresh(self.owner_b)

            self.shop_a_id = self.shop_a.id
            self.shop_b_id = self.shop_b.id
            self.owner_a_headers = {"Authorization": f"Bearer {create_access_token({'sub': str(self.owner_a.id)})}"}
            self.staff_a_headers = {"Authorization": f"Bearer {create_access_token({'sub': str(self.staff_a.id)})}"}
            self.owner_b_headers = {"Authorization": f"Bearer {create_access_token({'sub': str(self.owner_b.id)})}"}
        finally:
            db.close()

    # ── C1 & B1: Cross-tenant barcode/variant/batch isolation + per-shop barcode uniqueness ──
    def test_c1_cross_tenant_barcode_isolation_and_b1_per_shop_barcodes(self):
        prod_payload = {
            "product_name": "DAP 18-46-0",
            "company_name": "IFFCO",
            "category": "Fertilizer",
            "unit": "Bags",
            "purchase_price": "1100",
            "selling_price": "1400",
            "gst_rate": "5",
            "current_stock": "50",
            "batch_number": "SHARED-BATCH-01",
            "variants": [
                {
                    "variant_name": "50 Kg Bag",
                    "unit_size": 50,
                    "unit": "Kg",
                    "purchase_price": 1100,
                    "selling_price": 1400,
                    "barcode": "VAR-SECRET-999",
                }
            ],
        }
        # Tenant A creates first product -> auto barcode 10001
        r1 = self.client.post("/api/products", json=prod_payload, headers=self.owner_a_headers)
        self.assertEqual(r1.status_code, 201, r1.text)
        self.assertEqual(r1.json()["barcode"], "10001")

        # Tenant B creates first product -> ALSO auto barcode 10001 without IntegrityError (B1!)
        prod_b = dict(prod_payload, product_name="Beta Urea", batch_number="BETA-BATCH-ONLY", variants=[
            {"variant_name": "45 Kg Bag", "unit_size": 45, "unit": "Kg", "purchase_price": 250, "selling_price": 320, "barcode": "BETA-VAR-SECRET"}
        ])
        r2 = self.client.post("/api/products", json=prod_b, headers=self.owner_b_headers)
        self.assertEqual(r2.status_code, 201, r2.text)
        self.assertEqual(r2.json()["barcode"], "10001")

        # C1: Tenant A CANNOT query Tenant B's variant barcode or batch number
        res_var = self.client.get("/api/products/by-barcode/BETA-VAR-SECRET", headers=self.owner_a_headers)
        self.assertEqual(res_var.status_code, 404)

        res_batch = self.client.get("/api/products/by-barcode/BETA-BATCH-ONLY", headers=self.owner_a_headers)
        self.assertEqual(res_batch.status_code, 404)

        # Tenant B CAN query its own variant barcode and batch number
        own_var = self.client.get("/api/products/by-barcode/BETA-VAR-SECRET", headers=self.owner_b_headers)
        self.assertEqual(own_var.status_code, 200)
        self.assertEqual(own_var.json()["product"]["product_name"], "Beta Urea")

        own_batch = self.client.get("/api/products/by-barcode/BETA-BATCH-ONLY", headers=self.owner_b_headers)
        self.assertEqual(own_batch.status_code, 200)
        self.assertEqual(own_batch.json()["product"]["product_name"], "Beta Urea")

    # ── C2: Step Functions reports are strictly tenant-isolated ──
    def test_c2_step_functions_reports_tenant_isolated(self):
        from app import lambda_handler

        # Create one product & one sale per shop
        pa = self.client.post(
            "/api/products",
            json={"product_name": "Alpha Seed", "category": "Seeds", "unit": "Kg", "purchase_price": "100", "selling_price": "200", "gst_rate": "0", "current_stock": "20"},
            headers=self.owner_a_headers,
        ).json()
        pb = self.client.post(
            "/api/products",
            json={"product_name": "Beta Pesticide", "category": "Pesticide", "unit": "ml", "purchase_price": "300", "selling_price": "500", "gst_rate": "18", "current_stock": "10"},
            headers=self.owner_b_headers,
        ).json()
        self.client.post(
            "/api/sales",
            json={"items": [{"product_id": pa["id"], "product_name": pa["product_name"], "quantity": 2, "price": 200, "gst_rate": 0}]},
            headers=self.owner_a_headers,
        )
        self.client.post(
            "/api/sales",
            json={"items": [{"product_id": pb["id"], "product_name": pb["product_name"], "quantity": 3, "price": 500, "gst_rate": 18}]},
            headers=self.owner_b_headers,
        )

        now = datetime.now(timezone.utc)
        with patch("app.database.base.SessionLocal", self.TestingSessionLocal):
            # Scoped to Shop A -> never includes Shop B's 1500 sale
            res_a = lambda_handler.handle_step_function_action(
                {"action": "extract_monthly_summary", "shop_id": self.shop_a_id, "month": now.month, "year": now.year},
                None,
            )
            self.assertEqual(res_a["status"], "EXTRACTED")
            self.assertEqual(res_a["summary"]["total_sales"], 400.0)
            self.assertEqual(res_a["summary"]["active_products"], 1)

            # Unspecified shop_id -> returns separate isolated summaries per shop
            res_all = lambda_handler.handle_step_function_action(
                {"action": "extract_monthly_summary", "month": now.month, "year": now.year},
                None,
            )
            by_shop = {s["shop_id"]: s for s in res_all["shops"]}
            self.assertEqual(by_shop[self.shop_a_id]["total_sales"], 400.0)
            self.assertEqual(by_shop[self.shop_b_id]["total_sales"], 1500.0)

            # Stock valuation Excel is generated separately per shop
            stock_res = lambda_handler.handle_step_function_action(
                {"action": "generate_stock_valuation_excel", "month": now.month, "year": now.year},
                None,
            )
            self.assertEqual(stock_res["status"], "COMPLETED")
            self.assertEqual(len(stock_res["reports"]), 2)
            self.assertTrue(all(r["product_count"] == 1 for r in stock_res["reports"]))

    # ── C3: Strict CORS allowlist (never reflects attacker origins) ──
    def test_c3_cors_rejects_untrusted_origin_and_allows_whitelisted(self):
        evil = self.client.get("/health", headers={"Origin": "https://evil-attacker.example"})
        self.assertEqual(evil.status_code, 200)
        self.assertNotIn("access-control-allow-origin", evil.headers)

        good = self.client.get("/health", headers={"Origin": "http://localhost:5173"})
        self.assertEqual(good.status_code, 200)
        self.assertEqual(good.headers.get("access-control-allow-origin"), "http://localhost:5173")
        self.assertEqual(good.headers.get("access-control-allow-credentials"), "true")

    # ── C4: Production subscription activation blocked; HMAC webhook verified ──
    def test_c4_subscription_activation_gated_and_webhook_hmac_verified(self):
        orig_env = settings.environment
        orig_mode = settings.subscription_payment_mode
        orig_secret = settings.payment_webhook_secret
        try:
            settings.environment = "production"
            settings.subscription_payment_mode = "live"
            settings.payment_webhook_secret = "super-secret-webhook-key-for-hmac-tests"

            blocked = self.client.post(
                "/api/auth/activate-subscription",
                json={"plan_id": "pro", "plan_name": "Pro", "amount": 999, "payment_ref": "FAKE-REF"},
                headers=self.owner_a_headers,
            )
            self.assertEqual(blocked.status_code, 403)

            body = json.dumps({"shop_id": self.shop_a_id, "payment_ref": "RZP_12345", "plan_name": "Pro", "event": "payment.captured"}).encode("utf-8")
            bad_wh = self.client.post(
                "/api/auth/subscription-webhook",
                content=body,
                headers={"Content-Type": "application/json", "X-Payment-Signature": "deadbeef"},
            )
            self.assertEqual(bad_wh.status_code, 401)

            good_sig = hmac.new(settings.payment_webhook_secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
            good_wh = self.client.post(
                "/api/auth/subscription-webhook",
                content=body,
                headers={"Content-Type": "application/json", "X-Payment-Signature": good_sig},
            )
            self.assertEqual(good_wh.status_code, 200, good_wh.text)
            self.assertTrue(good_wh.json()["payment_verified"])
            self.assertEqual(good_wh.json()["subscription_status"], "ACTIVE")
        finally:
            settings.environment = orig_env
            settings.subscription_payment_mode = orig_mode
            settings.payment_webhook_secret = orig_secret

    # ── C5: Server-side POS pricing & GST enforcement ──
    def test_c5_pos_pricing_and_gst_derived_on_server(self):
        prod = self.client.post(
            "/api/products",
            json={"product_name": "DAP Bag", "category": "Fertilizer", "unit": "Bags", "purchase_price": "1100", "selling_price": "1400", "gst_rate": "5", "current_stock": "20"},
            headers=self.owner_a_headers,
        ).json()

        # Staff tries to forge Rs 1.00 price -> 403
        forged_price = self.client.post(
            "/api/sales",
            json={"items": [{"product_id": prod["id"], "product_name": "DAP Bag", "quantity": 1, "price": 1, "gst_rate": 5}]},
            headers=self.staff_a_headers,
        )
        self.assertEqual(forged_price.status_code, 403)

        # Staff tries to forge 0% GST -> 403
        forged_gst = self.client.post(
            "/api/sales",
            json={"items": [{"product_id": prod["id"], "product_name": "DAP Bag", "quantity": 1, "price": 1400, "gst_rate": 0}]},
            headers=self.staff_a_headers,
        )
        self.assertEqual(forged_gst.status_code, 403)

        # Staff tries unauthorized manual discount -> 403
        forged_disc = self.client.post(
            "/api/sales",
            json={"items": [{"product_id": prod["id"], "product_name": "DAP Bag", "quantity": 1, "price": 1400, "gst_rate": 5, "discount_percent": 50}]},
            headers=self.staff_a_headers,
        )
        self.assertEqual(forged_disc.status_code, 403)

        # Staff tries custom uncatalogued item -> 403
        custom_item = self.client.post(
            "/api/sales",
            json={"items": [{"product_name": "Manual Bypass", "quantity": 1, "price": 1, "gst_rate": 0}]},
            headers=self.staff_a_headers,
        )
        self.assertEqual(custom_item.status_code, 403)

        # Staff valid sale ignores tampered grand_total and computes exact 1400.00
        ok_sale = self.client.post(
            "/api/sales",
            json={"grand_total": 1399.05, "items": [{"product_id": prod["id"], "product_name": "DAP Bag", "quantity": 1, "price": 1400, "gst_rate": 5}]},
            headers=self.staff_a_headers,
        )
        self.assertEqual(ok_sale.status_code, 201, ok_sale.text)
        self.assertEqual(Decimal(str(ok_sale.json()["grand_total"])), Decimal("1400.0"))
        self.assertEqual(Decimal(str(ok_sale.json()["items"][0]["cost_price"])), Decimal("1100.0"))

        # Owner CAN override price and gets audited
        owner_override = self.client.post(
            "/api/sales",
            json={"items": [{"product_id": prod["id"], "product_name": "DAP Bag", "quantity": 1, "price": 1350, "gst_rate": 5}]},
            headers=self.owner_a_headers,
        )
        self.assertEqual(owner_override.status_code, 201, owner_override.text)
        self.assertEqual(Decimal(str(owner_override.json()["grand_total"])), Decimal("1350.0"))
        db = self.TestingSessionLocal()
        try:
            logs = db.query(AuditLog).filter(AuditLog.reference_id == owner_override.json()["id"]).all()
            self.assertTrue(any("Override on" in (l.description or "") for l in logs))
        finally:
            db.close()

    # ── H1: RBAC enforcement on privileged mutations ──
    def test_h1_rbac_blocks_staff_on_owner_endpoints(self):
        prod = self.client.post(
            "/api/products",
            json={"product_name": "Urea", "category": "Fertilizer", "unit": "Bags", "purchase_price": "250", "selling_price": "320", "gst_rate": "5", "current_stock": "10"},
            headers=self.owner_a_headers,
        ).json()
        exp = self.client.post(
            "/api/expenses",
            json={"expense_name": "Rent", "category": "RENT", "amount": 5000},
            headers=self.owner_a_headers,
        ).json()
        sale = self.client.post(
            "/api/sales",
            json={"items": [{"product_id": prod["id"], "product_name": "Urea", "quantity": 1, "price": 320, "gst_rate": 5}]},
            headers=self.owner_a_headers,
        ).json()

        self.assertEqual(self.client.put("/api/settings", json={"upi_id": "attacker@upi"}, headers=self.staff_a_headers).status_code, 403)
        self.assertEqual(self.client.delete(f"/api/products/{prod['id']}", headers=self.staff_a_headers).status_code, 403)
        self.assertEqual(self.client.post("/api/inventory/adjust", json={"product_id": prod["id"], "transaction_type": "DAMAGE", "quantity": 5}, headers=self.staff_a_headers).status_code, 403)
        self.assertEqual(self.client.delete(f"/api/expenses/{exp['id']}", headers=self.staff_a_headers).status_code, 403)
        self.assertEqual(
            self.client.post(
                "/api/returns",
                json={"sale_id": sale["id"], "items": [{"sale_item_id": sale["items"][0]["id"], "returned_quantity": 1}]},
                headers=self.staff_a_headers,
            ).status_code,
            403,
        )
        self.assertEqual(
            self.client.post("/api/price-lists", json={"name": "VIP", "adjustment_type": "DISCOUNT", "calculation_mode": "PERCENTAGE", "adjustment_value": 10}, headers=self.staff_a_headers).status_code,
            403,
        )

        # Owner succeeds on settings update and return
        self.assertEqual(self.client.put("/api/settings", json={"upi_id": "alpha@upi"}, headers=self.owner_a_headers).status_code, 200)
        ret = self.client.post(
            "/api/returns",
            json={
                "sale_id": sale["id"],
                "invoice_number": sale["invoice_number"],
                "items": [{"sale_item_id": sale["items"][0]["id"], "returned_quantity": 1}],
            },
            headers=self.owner_a_headers,
        )
        self.assertEqual(ret.status_code, 201, ret.text)

    # ── H2: Secrets Manager DB URL resolver & SQLAlchemy 2.1 psycopg2 driver loading ──
    def test_h2_secrets_manager_db_url_builder(self):
        from app.database.base import normalize_database_url

        fake_client = MagicMock()
        fake_client.get_secret_value.return_value = {
            "SecretString": json.dumps({"username": "pgadmin", "password": "p@ss/word#1"})
        }
        with patch("boto3.client", return_value=fake_client):
            url = build_database_url_from_secret("arn:aws:secretsmanager:ap-south-1:123:secret:db", "db.internal", 5432, "kisan_seva_db", "ap-south-1")
            self.assertEqual(url, "postgresql+psycopg2://pgadmin:p%40ss%2Fword%231@db.internal:5432/kisan_seva_db")

        # Verify bare postgresql:// and postgres:// URLs normalize to psycopg2 and instantiate an Engine cleanly
        self.assertEqual(
            normalize_database_url("postgresql://u:p@host:5432/db"),
            "postgresql+psycopg2://u:p@host:5432/db",
        )
        self.assertEqual(
            normalize_database_url("postgres://u:p@host:5432/db"),
            "postgresql+psycopg2://u:p@host:5432/db",
        )
        pg_engine = create_engine(url)
        try:
            self.assertEqual(pg_engine.dialect.name, "postgresql")
            self.assertEqual(pg_engine.dialect.driver, "psycopg2")
        finally:
            pg_engine.dispose()

        fake_client.get_secret_value.return_value = {"SecretString": json.dumps({"username": "only"})}
        with patch("boto3.client", return_value=fake_client):
            with self.assertRaises(SecretResolutionError):
                build_database_url_from_secret("arn:bad", "db.internal", 5432, "db", "ap-south-1")

    # ── H3, H4, H5: DB-backed CAPTCHA replay, rate limiting, no ?token=, no plaintext password, Google sub ──
    def test_h3_h4_h5_auth_hardening(self):
        # H4: ?token= query auth rejected everywhere
        raw_token = create_access_token({"sub": str(self.owner_a.id)})
        q_res = self.client.get(f"/api/auth/me?token={raw_token}")
        self.assertEqual(q_res.status_code, 401)
        b_res = self.client.get("/api/auth/me", headers=self.owner_a_headers)
        self.assertEqual(b_res.status_code, 200)

        # H3: CAPTCHA single-use persisted in DB (replay fails even across separate worker memory)
        tok, code = _make_signed_captcha("K7M9P2", "11223344556677889900aabbccddeeff")
        login_1 = self.client.post(
            "/api/auth/login",
            json={"username": "owner_a", "password": "AlphaPass#1", "captcha_token": tok, "captcha_code": code},
        )
        self.assertEqual(login_1.status_code, 200, login_1.text)
        _FALLBACK_USED_NONCES.clear()  # Simulate fresh Lambda container!
        login_replay = self.client.post(
            "/api/auth/login",
            json={"username": "owner_a", "password": "AlphaPass#1", "captcha_token": tok, "captcha_code": code},
        )
        self.assertEqual(login_replay.status_code, 400)
        self.assertIn("already been used", login_replay.json()["detail"].lower())

        # H3 & H5: Register requires CAPTCHA and does NOT echo initial_password
        reg_tok, reg_code = _make_signed_captcha("Z3X4C5", "ffeeddccbbaa00998877665544332211")
        with patch("app.routers.auth.send_welcome_account_email", return_value=True):
            reg = self.client.post(
                "/api/auth/register",
                json={
                    "owner_name": "Ramesh Kumar",
                    "username": "ramesh_agro",
                    "password": "SuperSecretPassword#99",
                    "email": "ramesh@example.com",
                    "shop_name": "Ramesh Krishi Kendra",
                    "captcha_token": reg_tok,
                    "captcha_code": reg_code,
                },
            )
        self.assertEqual(reg.status_code, 201, reg.text)
        self.assertNotIn("initial_password", reg.json()["credentials"])
        self.assertNotIn("SuperSecretPassword#99", reg.text)

        # H3: Rate limit triggers HTTP 429
        orig_limit = settings.rate_limit_otp_request_per_hour
        try:
            settings.rate_limit_otp_request_per_hour = 2
            self.assertEqual(self.client.post("/api/auth/forgot-password/request", json={"identifier": "nobody@example.com"}).status_code, 200)
            self.assertEqual(self.client.post("/api/auth/forgot-password/request", json={"identifier": "nobody@example.com"}).status_code, 200)
            r_429 = self.client.post("/api/auth/forgot-password/request", json={"identifier": "nobody@example.com"})
            self.assertEqual(r_429.status_code, 429)
        finally:
            settings.rate_limit_otp_request_per_hour = orig_limit

        # Unregistered user on /api/auth/login -> 404 ACCOUNT_NOT_FOUND; wrong password -> 401
        tok_nf, code_nf = _make_signed_captcha("N4F5O6", "a1b2c3d4e5f600112233445566778899")
        login_not_found = self.client.post(
            "/api/auth/login",
            json={"username": "no_such_shop_owner", "password": "SomePassword#1", "captcha_token": tok_nf, "captcha_code": code_nf},
        )
        self.assertEqual(login_not_found.status_code, 404, login_not_found.text)
        self.assertEqual(login_not_found.json()["detail"]["code"], "ACCOUNT_NOT_FOUND")
        self.assertEqual(login_not_found.json()["detail"]["identifier"], "no_such_shop_owner")

        tok_wp, code_wp = _make_signed_captcha("W7P8Q9", "b1c2d3e4f5a600112233445566778899")
        login_wrong_pwd = self.client.post(
            "/api/auth/login",
            json={"username": "owner_a", "password": "WrongPassword#99", "captcha_token": tok_wp, "captcha_code": code_wp},
        )
        self.assertEqual(login_wrong_pwd.status_code, 401, login_wrong_pwd.text)

        # H5: Google Auth blocks password-hijack/register/preflight on existing unlinked email (409),
        # returns 404 ACCOUNT_NOT_FOUND on mode="login" or mode="preflight" when no account exists (no silent ghost shop),
        # links verified Google login to legacy google_sub=None account without changing password_hash,
        # blocks linking a DIFFERENT google_sub (409), and creates full hybrid shop cleanly on mode="register".
        with patch("app.routers.auth.verify_google_token", return_value={"sub": "goog-sub-existing", "email": "alice@alpha.example", "email_verified": True, "name": "Attacker"}):
            hijack = self.client.post("/api/auth/google", json={"credential": "fake-id-token", "password": "HijackedPassword123"})
            self.assertEqual(hijack.status_code, 409)
            reg_dup = self.client.post("/api/auth/google", json={"credential": "fake-id-token", "mode": "register", "shop_name": "Dup"})
            self.assertEqual(reg_dup.status_code, 409)
            preflight_dup = self.client.post("/api/auth/google", json={"credential": "fake-id-token", "mode": "preflight"})
            self.assertEqual(preflight_dup.status_code, 409)

        # Unregistered Google user clicking "Continue with Google" on LoginPage (mode="login") or RegisterPage (mode="preflight") -> 404, 0 rows created
        with patch("app.routers.auth.verify_google_token", return_value={"sub": "goog-sub-new-1", "email": "newmerchant@example.com", "email_verified": True, "name": "New Merchant"}):
            not_found = self.client.post("/api/auth/google", json={"credential": "fake-id-token", "mode": "login"})
            self.assertEqual(not_found.status_code, 404, not_found.text)
            self.assertEqual(not_found.json()["detail"]["code"], "ACCOUNT_NOT_FOUND")
            self.assertEqual(not_found.json()["detail"]["email"], "newmerchant@example.com")
            preflight_ok = self.client.post("/api/auth/google", json={"credential": "fake-id-token", "mode": "preflight"})
            self.assertEqual(preflight_ok.status_code, 404, preflight_ok.text)
            self.assertEqual(preflight_ok.json()["detail"]["code"], "ACCOUNT_NOT_FOUND")
            db = self.TestingSessionLocal()
            try:
                self.assertIsNone(db.query(User).filter(User.email == "newmerchant@example.com").first())
            finally:
                db.close()

        # Same unregistered user completing full 3-step Shop Setup with Google (mode="register") + hybrid password
        with (
            patch("app.routers.auth.verify_google_token", return_value={"sub": "goog-sub-new-1", "email": "newmerchant@example.com", "email_verified": True, "name": "New Merchant"}),
            patch("app.routers.auth.send_welcome_account_email", return_value=True),
        ):
            new_g = self.client.post(
                "/api/auth/google",
                json={
                    "credential": "fake-id-token",
                    "mode": "register",
                    "owner_name": "New Merchant",
                    "username": "new_merchant_agro",
                    "phone": "9876543219",
                    "password": "HybridPassword#2026",
                    "shop_name": "New Agro Krishi Kendra",
                    "address_line1": "Market Yard Gate 2",
                    "city": "Nashik",
                    "state": "Maharashtra",
                    "pincode": "422001",
                    "gstin": "27ABCDE1234F1Z5",
                    "invoice_prefix": "NAK",
                    "fertilizer_license_no": "FL-2026-99",
                },
            )
            self.assertEqual(new_g.status_code, 200, new_g.text)
            self.assertEqual(new_g.json()["username"], "new_merchant_agro")
            self.assertEqual(new_g.json()["shop_name"], "New Agro Krishi Kendra")
            self.assertIsNotNone(new_g.json().get("credentials"))
            self.assertNotIn("initial_password", new_g.json()["credentials"])
            self.assertNotIn("HybridPassword#2026", new_g.text)
            db = self.TestingSessionLocal()
            try:
                u = db.query(User).filter(User.email == "newmerchant@example.com").first()
                self.assertEqual(u.google_sub, "goog-sub-new-1")
                self.assertEqual(u.username, "new_merchant_agro")
                self.assertEqual(u.phone, "9876543219")
                self.assertEqual(u.shop.address_line1, "Market Yard Gate 2")
                self.assertEqual(u.shop.city, "Nashik")
                self.assertEqual(u.shop.pincode, "422001")
                self.assertEqual(u.shop.fertilizer_license_no, "FL-2026-99")
            finally:
                db.close()

            # Hybrid Sign-In Verification:
            # 1) Next time user can sign in via Google (mode="login")
            g_next = self.client.post("/api/auth/google", json={"credential": "fake-id-token", "mode": "login"})
            self.assertEqual(g_next.status_code, 200, g_next.text)
            # 2) Next time user can ALSO sign in via email/username + password on /api/auth/login
            tok_hyb, code_hyb = _make_signed_captcha("H1Y2B3", "c1d2e3f4a5b600112233445566778899")
            pwd_next = self.client.post(
                "/api/auth/login",
                json={
                    "username": "newmerchant@example.com",
                    "password": "HybridPassword#2026",
                    "captcha_token": tok_hyb,
                    "captcha_code": code_hyb,
                },
            )
            self.assertEqual(pwd_next.status_code, 200, pwd_next.text)
            self.assertEqual(pwd_next.json()["username"], "new_merchant_agro")

        # Legacy existing user (google_sub=None) signing in via mode="login" links google_sub without altering password
        with patch("app.routers.auth.verify_google_token", return_value={"sub": "goog-sub-alice", "email": "alice@alpha.example", "email_verified": True, "name": "Alice Owner"}):
            linked = self.client.post("/api/auth/google", json={"credential": "fake-id-token", "mode": "login"})
            self.assertEqual(linked.status_code, 200, linked.text)
            db = self.TestingSessionLocal()
            try:
                alice = db.query(User).filter(User.email == "alice@alpha.example").first()
                self.assertEqual(alice.google_sub, "goog-sub-alice")
                self.assertTrue(verify_password("AlphaPass#1", alice.password_hash))
            finally:
                db.close()

        # Different google_sub trying to log in with Alice's already-linked email -> 409 Conflict
        with patch("app.routers.auth.verify_google_token", return_value={"sub": "goog-sub-different", "email": "alice@alpha.example", "email_verified": True, "name": "Spoofer"}):
            conflict = self.client.post("/api/auth/google", json={"credential": "fake-id-token", "mode": "login"})
            self.assertEqual(conflict.status_code, 409)

    # ── M1: Tenant-scoped authenticated /uploads ──
    def test_m1_authenticated_tenant_scoped_uploads(self):
        (self.upload_dir / "shop_1_logo.png").write_bytes(_make_valid_png_bytes())
        (self.upload_dir / "shop_2_logo.png").write_bytes(_make_valid_png_bytes())

        self.assertEqual(self.client.get("/uploads/shop_1_logo.png").status_code, 401)
        self.assertEqual(self.client.get("/uploads/shop_2_logo.png", headers=self.owner_a_headers).status_code, 404)
        own = self.client.get("/uploads/shop_1_logo.png", headers=self.owner_a_headers)
        self.assertEqual(own.status_code, 200)
        self.assertIn("private", own.headers.get("cache-control", ""))

    # ── M2 & B7: OCR magic bytes, bounded read, threadpool execution & sanitized 422 ──
    def test_m2_and_b7_ocr_validation_and_threadpool(self):
        fake_jpg = self.client.post(
            "/api/ocr/extract",
            files={"file": ("evil.jpg", b"<html>not an image</html>", "image/jpeg")},
            headers=self.owner_a_headers,
        )
        self.assertEqual(fake_jpg.status_code, 400)

        fake_provider = MagicMock()
        fake_provider.extract.side_effect = RuntimeError("INTERNAL_TESSERACT_SECRET_PATH=/etc/secret")
        with patch("app.routers.ocr.get_ocr_provider", return_value=fake_provider):
            err_res = self.client.post(
                "/api/ocr/extract",
                files={"file": ("label.png", _make_valid_png_bytes(), "image/png")},
                headers=self.owner_a_headers,
            )
            self.assertEqual(err_res.status_code, 422)
            self.assertNotIn("INTERNAL_TESSERACT_SECRET_PATH", err_res.text)

    # ── B5, B6, B7, B10: GST slabs, immutable COGS snapshot, single PDF gen, X-Total-Count pagination ──
    def test_b5_b6_b7_b10_reports_cogs_pdf_and_pagination(self):
        # Create 3 products across 0%, 12%, and 18% GST slabs
        p_seed = self.client.post(
            "/api/products",
            json={"product_name": "Hybrid Cotton Seed", "category": "Seeds", "unit": "Packets", "purchase_price": "500", "selling_price": "800", "gst_rate": "0", "current_stock": "20"},
            headers=self.owner_a_headers,
        ).json()
        p_micro = self.client.post(
            "/api/products",
            json={"product_name": "Zinc Chelated", "category": "Micronutrients", "unit": "Kg", "purchase_price": "200", "selling_price": "336", "gst_rate": "12", "current_stock": "20"},
            headers=self.owner_a_headers,
        ).json()
        p_pest = self.client.post(
            "/api/products",
            json={"product_name": "Imidacloprid 17.8% SL", "category": "Pesticide", "unit": "ml", "purchase_price": "300", "selling_price": "590", "gst_rate": "18", "current_stock": "20"},
            headers=self.owner_a_headers,
        ).json()

        # B10: Pagination header X-Total-Count
        page1 = self.client.get("/api/products?skip=0&limit=2", headers=self.owner_a_headers)
        self.assertEqual(page1.status_code, 200)
        self.assertEqual(len(page1.json()), 2)
        self.assertEqual(page1.headers.get("x-total-count"), "3")

        # Create a sale with 0%, 12%, and 18% items
        sale = self.client.post(
            "/api/sales",
            json={
                "items": [
                    {"product_id": p_seed["id"], "product_name": p_seed["product_name"], "quantity": 1, "price": 800, "gst_rate": 0},
                    {"product_id": p_micro["id"], "product_name": p_micro["product_name"], "quantity": 1, "price": 336, "gst_rate": 12},
                    {"product_id": p_pest["id"], "product_name": p_pest["product_name"], "quantity": 1, "price": 590, "gst_rate": 18},
                ]
            },
            headers=self.owner_a_headers,
        ).json()

        # B6: Refill seed at a much higher purchase price (999) — historical COGS MUST NOT change!
        refill = self.client.post(
            "/api/products/refill",
            json={"product_id": p_seed["id"], "additional_quantity": 10, "purchase_price": 999, "selling_price": 1200},
            headers=self.owner_a_headers,
        )
        self.assertEqual(refill.status_code, 200, refill.text)

        pl = self.client.get("/api/reports/profit-loss", headers=self.owner_a_headers).json()
        # Original COGS = 500 + 200 + 300 = 1000 (NOT 999 + 200 + 300 = 1499!)
        self.assertEqual(pl["cost_of_goods"], 1000.0)

        analytics = self.client.get("/api/reports/analytics?preset=this_month", headers=self.owner_a_headers).json()
        self.assertEqual(analytics["summary"]["total_cogs"], 1000.0)
        self.assertEqual(analytics["summary"]["total_bills"], 1)

        # B6: GST report includes 0%, 5%, 12%, 18%, 28% slabs accurately
        gst = self.client.get("/api/reports/gst", headers=self.owner_a_headers).json()
        slabs = {row["gst_rate"]: row for row in gst["gst_breakdown"]}
        self.assertEqual(set(slabs.keys()), {0.0, 5.0, 12.0, 18.0, 28.0})
        self.assertEqual(slabs[0.0]["taxable_value"], 800.0)
        self.assertEqual(slabs[12.0]["taxable_value"], 300.0)
        self.assertEqual(slabs[12.0]["total_tax"], 36.0)
        self.assertEqual(slabs[18.0]["taxable_value"], 500.0)
        self.assertEqual(slabs[18.0]["total_tax"], 90.0)

        # B7: Invoice PDF generated ONCE even when s3_enabled=True and redirect_s3=False
        orig_s3 = settings.s3_enabled
        try:
            settings.s3_enabled = True
            with (
                patch("app.routers.invoices.check_report_exists_in_s3", return_value=False),
                patch("app.routers.invoices.upload_report_to_s3", return_value="k.pdf"),
                patch("app.routers.invoices.generate_invoice_pdf", return_value=b"%PDF-1.4 mock") as gen_mock,
            ):
                pdf_res = self.client.get(f"/api/invoices/{sale['id']}/pdf?redirect_s3=false", headers=self.owner_a_headers)
                self.assertEqual(pdf_res.status_code, 200)
                self.assertEqual(gen_mock.call_count, 1)
        finally:
            settings.s3_enabled = orig_s3

    # ── Direct bcrypt & M3 helper & frontend Lambda handler CORS/error checks ──
    def test_direct_bcrypt_m3_and_frontend_lambda_security(self):
        long_pw = "A" * 100
        h = hash_password(long_pw)
        self.assertTrue(verify_password(long_pw, h))
        self.assertFalse(verify_password("wrong", h))
        self.assertFalse(verify_password("", h))
        self.assertFalse(verify_password("abc", "corrupt-hash"))

        # M3: internal_server_error never leaks raw exception text
        import logging
        test_logger = logging.getLogger("test_m3")
        try:
            raise ValueError("SECRET_DB_CONNECTION_STRING")
        except ValueError:
            http_exc = internal_server_error(test_logger, "Operation failed")
        self.assertEqual(http_exc.status_code, 500)
        self.assertNotIn("SECRET_DB_CONNECTION_STRING", http_exc.detail)
        self.assertIn("Reference:", http_exc.detail)

        # C3 & M6 on frontend/lambda_handler.py
        import importlib.util
        spec = importlib.util.spec_from_file_location("frontend_lambda", str(REPO_ROOT / "frontend" / "lambda_handler.py"))
        mod = importlib.util.module_from_spec(spec)
        with patch.dict(os.environ, {"ALLOWED_ORIGINS": "https://nockbill.com"}):
            spec.loader.exec_module(mod)
            csp = mod.SECURITY_HEADERS["Content-Security-Policy"]
            self.assertNotIn("connect-src 'self' https: ", csp)
            self.assertIn("https://nockbill.com", csp)
            bad_cors = mod.cors_headers({"headers": {"origin": "https://evil.example"}})
            self.assertNotIn("Access-Control-Allow-Origin", bad_cors)
            good_cors = mod.cors_headers({"headers": {"origin": "https://nockbill.com"}})
            self.assertEqual(good_cors.get("Access-Control-Allow-Origin"), "https://nockbill.com")
            self.assertEqual(good_cors.get("Access-Control-Allow-Credentials"), "true")

    # ── S6: Server-side JWT revocation on logout AND password reset ──
    def test_s6_jwt_revocation_on_logout_and_password_reset(self):
        from app.models.models import PasswordResetCode
        from datetime import timedelta

        # 1. Login via /api/auth/login -> JWT bound to token_version=1
        tok, code = _make_signed_captcha()
        login_res = self.client.post(
            "/api/auth/login",
            json={"username": "owner_a", "password": "AlphaPass#1", "captcha_token": tok, "captcha_code": code},
        )
        self.assertEqual(login_res.status_code, 200, login_res.text)
        token_v1 = login_res.json()["access_token"]
        headers_v1 = {"Authorization": f"Bearer {token_v1}"}

        # Active before logout
        self.assertEqual(self.client.get("/api/auth/me", headers=headers_v1).status_code, 200)

        # Logout revokes token_v1 server-side
        logout_res = self.client.post("/api/auth/logout", headers=headers_v1)
        self.assertEqual(logout_res.status_code, 200)
        self.assertEqual(self.client.get("/api/auth/me", headers=headers_v1).status_code, 401)

        # 2. Re-login -> gets token_v2 (token_version=2)
        tok2, code2 = _make_signed_captcha(nonce="11111111111111111111111111111111")
        login_res2 = self.client.post(
            "/api/auth/login",
            json={"username": "owner_a", "password": "AlphaPass#1", "captcha_token": tok2, "captcha_code": code2},
        )
        self.assertEqual(login_res2.status_code, 200, login_res2.text)
        token_v2 = login_res2.json()["access_token"]
        headers_v2 = {"Authorization": f"Bearer {token_v2}"}
        self.assertEqual(self.client.get("/api/auth/me", headers=headers_v2).status_code, 200)

        # 3. Password reset revokes token_v2 immediately
        raw_reset_token = "verified-reset-token-secret-xyz"
        now_utc = datetime.now(timezone.utc)
        db = self.TestingSessionLocal()
        try:
            db.add(PasswordResetCode(
                user_id=self.owner_a.id,
                username=self.owner_a.username,
                code_hash=hashlib.sha256(b"654321").hexdigest(),
                verified=True,
                verified_token=hashlib.sha256(raw_reset_token.encode("utf-8")).hexdigest(),
                verified_at=now_utc,
                expires_at=now_utc + timedelta(minutes=15),
            ))
            db.commit()
        finally:
            db.close()

        with patch("app.routers.auth.send_password_reset_confirmation_email", return_value=True):
            reset_res = self.client.post(
                "/api/auth/forgot-password/reset",
                json={"identifier": "owner_a", "reset_token": raw_reset_token, "new_password": "NewStrongPass#2"},
            )
        self.assertEqual(reset_res.status_code, 200, reset_res.text)

        # token_v2 MUST now be rejected with 401
        self.assertEqual(self.client.get("/api/auth/me", headers=headers_v2).status_code, 401)

        # Login with new password yields valid token_v3
        tok3, code3 = _make_signed_captcha(nonce="22222222222222222222222222222222")
        login_res3 = self.client.post(
            "/api/auth/login",
            json={"username": "owner_a", "password": "NewStrongPass#2", "captcha_token": tok3, "captcha_code": code3},
        )
        self.assertEqual(login_res3.status_code, 200, login_res3.text)
        headers_v3 = {"Authorization": f"Bearer {login_res3.json()['access_token']}"}
        self.assertEqual(self.client.get("/api/auth/me", headers=headers_v3).status_code, 200)

        # Non-numeric sub is strictly rejected (S6)
        non_num_token = create_access_token({"sub": "owner_a", "tv": 3})
        self.assertEqual(
            self.client.get("/api/auth/me", headers={"Authorization": f"Bearer {non_num_token}"}).status_code,
            401,
        )

    # ── S2 & SD6: Trusted IP extraction & global rate-limit stale-row pruning ──
    def test_s2_trusted_ip_extraction_and_sd6_rate_limit_pruning(self):
        from datetime import timedelta
        from app.utils.rate_limit import enforce_rate_limit, get_client_ip

        # 1. Lambda API Gateway sourceIp overrides spoofed X-Forwarded-For
        req_lambda = MagicMock()
        req_lambda.scope = {"aws.event": {"requestContext": {"http": {"sourceIp": "198.51.100.77"}}}}
        req_lambda.headers = {"x-forwarded-for": "1.2.3.4, 5.6.7.8"}
        req_lambda.client = MagicMock(host="127.0.0.1")
        self.assertEqual(get_client_ip(req_lambda), "198.51.100.77")

        # 2. CloudFront-Viewer-Address overrides spoofed X-Forwarded-For
        req_cf = MagicMock()
        req_cf.scope = {}
        req_cf.headers = {
            "cloudfront-viewer-address": "203.0.113.42:54321",
            "x-forwarded-for": "9.9.9.9, 10.0.0.1",
        }
        req_cf.client = MagicMock(host="127.0.0.1")
        self.assertEqual(get_client_ip(req_cf), "203.0.113.42")

        # 3. Rightmost X-Forwarded-For hop used instead of client-spoofable leftmost slot 0
        req_xff = MagicMock()
        req_xff.scope = {}
        req_xff.headers = {"x-forwarded-for": "1.1.1.1, 192.0.2.88"}
        req_xff.client = MagicMock(host="127.0.0.1")
        self.assertEqual(get_client_ip(req_xff), "192.0.2.88")

        # 4. SD6: Global 24h stale-row cleanup prunes abandoned buckets
        db = self.TestingSessionLocal()
        try:
            stale = RateLimitEvent(
                bucket="old_abandoned_bucket:99.99.99.99",
                created_at=datetime.now(timezone.utc) - timedelta(hours=36),
            )
            db.add(stale)
            db.commit()
            enforce_rate_limit(db, "login_ip", "192.0.2.10", limit=10, window_seconds=900)
            remaining_stale = db.query(RateLimitEvent).filter(
                RateLimitEvent.bucket == "old_abandoned_bucket:99.99.99.99"
            ).count()
            self.assertEqual(remaining_stale, 0)
        finally:
            db.close()

    # ── S3 & S7: ReportLab XML, HTML email, Excel formula & Content-Disposition sanitization ──
    def test_s3_and_s7_escaping_and_filename_sanitization(self):
        from openpyxl import load_workbook
        from app.reports.excel_export import export_stock_report_excel
        from app.schemas.schemas import StockReportRow
        from app.utils.helpers import escape_html_text, sanitize_download_filename, sanitize_excel_cell

        self.assertEqual(escape_html_text("<script>x&y</script>"), "&lt;script&gt;x&amp;y&lt;/script&gt;")
        self.assertEqual(sanitize_excel_cell("=CMD|' /C calc'!A0"), "'=CMD|' /C calc'!A0")
        self.assertEqual(sanitize_excel_cell("+SUM(A1:A2)"), "'+SUM(A1:A2)")
        self.assertEqual(sanitize_excel_cell("Normal Urea"), "Normal Urea")
        clean_fn = sanitize_download_filename('INV"\r\nX-Injected: 1/../../evil.pdf', fallback="Invoice.pdf")
        self.assertNotIn("\r", clean_fn)
        self.assertNotIn("\n", clean_fn)
        self.assertNotIn('"', clean_fn)
        self.assertNotIn("/", clean_fn)

        # Excel export neutralizes formula cells
        xl_bytes = export_stock_report_excel([
            StockReportRow(
                product_id=1,
                product_name="=CMD|' /C calc'!A0",
                company_name="+CORP",
                net_content="@HYPERLINK(\"http://evil\")",
                opening_stock=Decimal("5"),
                purchased=Decimal("0"),
                sold=Decimal("0"),
                returned=Decimal("0"),
                damaged=Decimal("0"),
                current_stock=Decimal("5"),
                minimum_stock=Decimal("1"),
                stock_value=Decimal("500"),
            )
        ])
        wb = load_workbook(io.BytesIO(xl_bytes))
        ws = wb.active
        self.assertTrue(str(ws["A2"].value).startswith("'="))
        self.assertTrue(str(ws["B2"].value).startswith("'+"))
        self.assertTrue(str(ws["C2"].value).startswith("'@"))

        # PDF generation succeeds even with XML-breaking `&`, `<`, `>` in shop/product/customer names
        self.client.put(
            "/api/settings",
            json={"shop_name": "Kisan & Sons <Agro> \"Depot\""},
            headers=self.owner_a_headers,
        )
        prod = self.client.post(
            "/api/products",
            json={
                "product_name": "NPK 19:19:19 & Zinc <Pure>",
                "company_name": "A&B Fertilizers",
                "category": "Fertilizer",
                "unit": "Bags",
                "purchase_price": "800",
                "selling_price": "1000",
                "gst_rate": "5",
                "current_stock": "20",
            },
            headers=self.owner_a_headers,
        ).json()
        sale = self.client.post(
            "/api/sales",
            json={
                "customer_name": "Ram & Shyam <Farm>",
                "items": [{"product_id": prod["id"], "product_name": prod["product_name"], "quantity": 1, "price": 1000, "gst_rate": 5}],
            },
            headers=self.owner_a_headers,
        ).json()

        inv_pdf = self.client.get(f"/api/invoices/{sale['id']}/pdf?redirect_s3=false", headers=self.owner_a_headers)
        self.assertEqual(inv_pdf.status_code, 200)
        self.assertTrue(inv_pdf.content.startswith(b"%PDF-"))
        self.assertNotIn("\n", inv_pdf.headers.get("content-disposition", ""))

        bc_pdf = self.client.get(f"/api/products/{prod['id']}/barcode-label.pdf", headers=self.owner_a_headers)
        self.assertEqual(bc_pdf.status_code, 200)
        self.assertTrue(bc_pdf.content.startswith(b"%PDF-"))

    # ── S8: Frontend Lambda OAuth origin validation & realpath containment ──
    def test_s8_frontend_lambda_oauth_origin_and_traversal(self):
        import importlib.util
        spec = importlib.util.spec_from_file_location("frontend_lambda_s8", str(REPO_ROOT / "frontend" / "lambda_handler.py"))
        mod = importlib.util.module_from_spec(spec)
        with patch.dict(os.environ, {"ALLOWED_ORIGINS": "https://nockbill.com"}):
            spec.loader.exec_module(mod)
            # Disallowed origin on /oauth/google-verify -> 403
            resp_bad = mod.handler({
                "requestContext": {"http": {"method": "POST", "path": "/oauth/google-verify"}},
                "headers": {"origin": "https://attacker.example"},
                "body": json.dumps({"credential": "fake"}),
            }, None)
            self.assertEqual(resp_bad["statusCode"], 403)

            # Path traversal outside DIST_DIR never reads lambda_handler.py
            resp_trav = mod.handler({
                "requestContext": {"http": {"method": "GET", "path": "/../lambda_handler.py"}},
                "headers": {},
            }, None)
            self.assertNotIn("def handler(", resp_trav.get("body", ""))

    # ── SC1, SC2, SC3, SC4, SC6, SC7, SC8, SC9: Schema Consistency ──
    def test_sc1_to_sc9_schema_consistency(self):
        # SC6 & SC8: Frontend alias fields (name, cost_price, min_stock_level) & string net_content
        p_res = self.client.post(
            "/api/products",
            json={
                "name": "Hybrid Cotton Seed",
                "category": "Seeds",
                "unit": "Packets",
                "net_content": "450 gm",
                "cost_price": "600",
                "selling_price": "850",
                "gst_rate": "0",
                "current_stock": "3",
                "min_stock_level": "10",
                "hsn_code": "",
            },
            headers=self.owner_a_headers,
        )
        self.assertEqual(p_res.status_code, 201, p_res.text)
        prod = p_res.json()
        self.assertEqual(prod["product_name"], "Hybrid Cotton Seed")
        self.assertEqual(prod["purchase_price"], 600.0)
        self.assertEqual(prod["minimum_stock"], 10.0)
        self.assertEqual(prod["net_content"], 450.0)
        self.assertEqual(prod["hsn_code"], "")

        # SC7: ProductBatch.expiry_date is None (not "" or fabricated date) when omitted
        db = self.TestingSessionLocal()
        try:
            batch = db.query(ProductBatch).filter(ProductBatch.product_id == prod["id"]).first()
            self.assertIsNotNone(batch)
            self.assertIsNone(batch.expiry_date)
        finally:
            db.close()

        # SC1: Interstate sale persists all customer/GST/discount/HSN fields; no "31021000" Urea default
        s_res = self.client.post(
            "/api/sales",
            json={
                "customer_name": "Kisan Co-op",
                "customer_address": "12 Mandi Road, Pune",
                "customer_aadhar": "123456789012",
                "customer_gstin": "27AABCU9603R1ZM",
                "is_interstate": True,
                "round_off": 0.0,
                "items": [
                    {
                        "product_id": prod["id"],
                        "product_name": prod["product_name"],
                        "quantity": 1,
                        "price": 850,
                        "mrp": 900,
                        "gst_rate": 0,
                        "discount_percent": 10,
                        "hsn_code": "",
                        "unit": "Packets",
                    }
                ],
            },
            headers=self.owner_a_headers,
        )
        self.assertEqual(s_res.status_code, 201, s_res.text)
        sale_id = s_res.json()["id"]
        fetched_sale = self.client.get(f"/api/sales/{sale_id}", headers=self.owner_a_headers).json()
        self.assertEqual(fetched_sale["customer_address"], "12 Mandi Road, Pune")
        self.assertEqual(fetched_sale["customer_aadhar"], "123456789012")
        self.assertEqual(fetched_sale["customer_gstin"], "27AABCU9603R1ZM")
        self.assertTrue(fetched_sale["is_interstate"])
        self.assertEqual(fetched_sale["total_discount"], 85.0)
        self.assertEqual(fetched_sale["items"][0]["hsn_code"], "")
        self.assertEqual(fetched_sale["items"][0]["discount_percent"], 10.0)
        self.assertEqual(fetched_sale["items"][0]["mrp"], 900.0)

        # SC2: RefillRecommendation exposes canonical TS keys
        refills = self.client.get("/api/products/recommend-refill", headers=self.owner_a_headers).json()
        self.assertGreaterEqual(len(refills), 1)
        rec = refills[0]
        for key in ("sales_velocity_per_day", "days_of_stock_left", "urgency_reason", "suggested_refill_quantity"):
            self.assertIn(key, rec)

        # SC3: Expense payment_mode + Packaging/Office categories round-trip cleanly
        exp_pkg = self.client.post(
            "/api/expenses",
            json={"category": "Packaging", "amount": 450, "description": "HDPE bags", "payment_mode": "UPI"},
            headers=self.owner_a_headers,
        )
        self.assertEqual(exp_pkg.status_code, 201, exp_pkg.text)
        self.assertEqual(exp_pkg.json()["category"], "Packaging")
        self.assertEqual(exp_pkg.json()["payment_mode"], "UPI")

        exp_off = self.client.post(
            "/api/expenses",
            json={"category": "Office", "amount": 300, "description": "Bill rolls", "payment_mode": "Bank Transfer"},
            headers=self.owner_a_headers,
        )
        self.assertEqual(exp_off.status_code, 201, exp_off.text)
        self.assertEqual(exp_off.json()["category"], "Office")
        self.assertEqual(exp_off.json()["payment_mode"], "Bank Transfer")

        # SC3 & SC4: Purchase persists supplier_gstin cleanly, uses product_id=None for unlinked items (never 1), rejects foreign product_id
        pur_unlinked = self.client.post(
            "/api/purchases",
            json={
                "supplier_name": "Depot X",
                "supplier_gstin": "24AABCI1234E1Z0",
                "bill_number": "PUR-UNLINKED-1",
                "notes": "Direct inward",
                "items": [{"product_name": "Unregistered Sprayer Nozzle", "quantity": 5, "purchase_price": 100, "gst_rate": 18}],
            },
            headers=self.owner_a_headers,
        )
        self.assertEqual(pur_unlinked.status_code, 201, pur_unlinked.text)
        pur_data = pur_unlinked.json()
        self.assertEqual(pur_data["supplier_gstin"], "24AABCI1234E1Z0")
        self.assertEqual(pur_data["notes"], "Direct inward")
        self.assertIsNone(pur_data["items"][0]["product_id"])

        pur_bad_fk = self.client.post(
            "/api/purchases",
            json={
                "supplier_name": "Depot Y",
                "bill_number": "PUR-BAD-FK",
                "items": [{"product_id": 99999, "product_name": "Ghost", "quantity": 1, "purchase_price": 10}],
            },
            headers=self.owner_a_headers,
        )
        self.assertEqual(pur_bad_fk.status_code, 404)

        # SC9: ShopSettings response includes subscription_status
        settings_res = self.client.get("/api/settings", headers=self.owner_a_headers).json()
        self.assertIn("subscription_status", settings_res)

    # ── SD1, SD2, SD3, SD4, SD5, SD7: Returns netting, 3-way stock sync, idempotency, bounds, IST ──
    def test_sd1_to_sd7_returns_stock_sync_idempotency_and_ist_reports(self):
        from datetime import date as dt_date
        from app.routers.reports import _ist_end_to_utc_naive, _ist_start_to_utc_naive

        # SD7: Verify exact IST (+05:30) day boundaries converted to UTC-naive
        ist_s = _ist_start_to_utc_naive(dt_date(2026, 11, 21))
        ist_e = _ist_end_to_utc_naive(dt_date(2026, 11, 21))
        self.assertEqual(ist_s, datetime(2026, 11, 20, 18, 30, 0))
        self.assertEqual(ist_e, datetime(2026, 11, 21, 18, 29, 59, 999999))

        # SD3: Create product with 1 variant & 1 batch at stock=20
        p_a = self.client.post(
            "/api/products",
            json={
                "product_name": "Chlorpyrifos 20% EC",
                "category": "Pesticide",
                "unit": "Litre",
                "purchase_price": "100",
                "selling_price": "236",
                "gst_rate": "18",
                "current_stock": "20",
                "batch_number": "CHL-01",
            },
            headers=self.owner_a_headers,
        ).json()
        p_b = self.client.post(
            "/api/products",
            json={
                "product_name": "Beta Fertilizer",
                "category": "Fertilizer",
                "unit": "Bags",
                "purchase_price": "100",
                "selling_price": "210",
                "gst_rate": "5",
                "current_stock": "10",
            },
            headers=self.owner_b_headers,
        ).json()

        # SD4: Per-shop idempotency_key replay & cross-shop independence
        idem_key = "sale-test-idempotency-12345"
        s1 = self.client.post(
            "/api/sales",
            json={
                "idempotency_key": idem_key,
                "items": [{"product_id": p_a["id"], "product_name": p_a["product_name"], "quantity": 5, "price": 236, "gst_rate": 18}],
            },
            headers=self.owner_a_headers,
        )
        self.assertEqual(s1.status_code, 201, s1.text)
        s1_replay = self.client.post(
            "/api/sales",
            json={
                "idempotency_key": idem_key,
                "items": [{"product_id": p_a["id"], "product_name": p_a["product_name"], "quantity": 5, "price": 236, "gst_rate": 18}],
            },
            headers=self.owner_a_headers,
        )
        self.assertEqual(s1_replay.status_code, 201)
        self.assertEqual(s1_replay.json()["id"], s1.json()["id"])

        # Shop B can reuse the exact same idempotency key without collision
        s_b = self.client.post(
            "/api/sales",
            json={
                "idempotency_key": idem_key,
                "items": [{"product_id": p_b["id"], "product_name": p_b["product_name"], "quantity": 1, "price": 210, "gst_rate": 5}],
            },
            headers=self.owner_b_headers,
        )
        self.assertEqual(s_b.status_code, 201, s_b.text)
        self.assertNotEqual(s_b.json()["id"], s1.json()["id"])

        # Verify 3-way stock after sale of 5 -> 15 across Product, ProductBatch, ProductVariant
        def assert_stock_synced(expected: float):
            prod_now = self.client.get(f"/api/products/{p_a['id']}", headers=self.owner_a_headers).json()
            self.assertEqual(prod_now["current_stock"], expected)
            self.assertEqual(prod_now["batches"][0]["current_stock"], expected)
            self.assertEqual(prod_now["variants"][0]["stock"], expected)

        assert_stock_synced(15.0)

        # SD1 & SD2: Return 2 of the 5 sold units
        sale_item_id = s1.json()["items"][0]["id"]
        ret_res = self.client.post(
            "/api/returns",
            json={
                "sale_id": s1.json()["id"],
                "invoice_number": s1.json()["invoice_number"],
                "refund_payment_method": "CASH",
                "reason": "Excess quantity",
                "items": [{"sale_item_id": sale_item_id, "returned_quantity": 2}],
            },
            headers=self.owner_a_headers,
        )
        self.assertEqual(ret_res.status_code, 201, ret_res.text)
        assert_stock_synced(17.0)

        # Over-return blocked (only 3 left, requesting 4 -> 400)
        over_ret = self.client.post(
            "/api/returns",
            json={
                "sale_id": s1.json()["id"],
                "invoice_number": s1.json()["invoice_number"],
                "items": [{"sale_item_id": sale_item_id, "returned_quantity": 4}],
            },
            headers=self.owner_a_headers,
        )
        self.assertEqual(over_ret.status_code, 400)

        # SD2: Verify GST, P&L, Dashboard, and Analytics ALL net out the 2 returned units!
        # Sold 5 * 236 = 1180 (taxable 1000, GST 180, COGS 500)
        # Returned 2 * 236 = 472 (taxable 400, GST 72, COGS 200)
        # Net: sales=708, taxable=600, GST=108, COGS=300
        gst = self.client.get("/api/reports/gst", headers=self.owner_a_headers).json()
        self.assertAlmostEqual(float(gst["total_taxable"]), 600.0, places=2)
        self.assertAlmostEqual(float(gst["total_gst"]), 108.0, places=2)

        pl = self.client.get("/api/reports/profit-loss", headers=self.owner_a_headers).json()
        self.assertAlmostEqual(float(pl["gross_sales"]), 1180.0, places=2)
        self.assertAlmostEqual(float(pl["total_returns"]), 472.0, places=2)
        self.assertAlmostEqual(float(pl["total_sales"]), 708.0, places=2)
        self.assertAlmostEqual(float(pl["cost_of_goods"]), 300.0, places=2)

        dash = self.client.get("/api/reports/dashboard", headers=self.owner_a_headers).json()
        self.assertAlmostEqual(float(dash["today_sales"]), 708.0, places=2)
        self.assertAlmostEqual(float(dash["today_gst"]), 108.0, places=2)
        self.assertAlmostEqual(float(dash["month_sales"]), 708.0, places=2)

        analytics = self.client.get("/api/reports/analytics?preset=this_month", headers=self.owner_a_headers).json()
        self.assertAlmostEqual(float(analytics["summary"]["total_revenue"]), 708.0, places=2)
        self.assertAlmostEqual(float(analytics["summary"]["total_returns"]), 472.0, places=2)
        self.assertAlmostEqual(float(analytics["summary"]["total_gst"]), 108.0, places=2)
        self.assertAlmostEqual(float(analytics["summary"]["total_cogs"]), 300.0, places=2)

        # SD3: Refill (+10 -> 27), Manual adjust (-3 -> 24), Purchase (+6 -> 30) all keep 3-way sync
        self.client.post(
            "/api/products/refill",
            json={"product_id": p_a["id"], "additional_quantity": 10, "batch_number": "CHL-01"},
            headers=self.owner_a_headers,
        )
        assert_stock_synced(27.0)

        self.client.post(
            "/api/inventory/adjust",
            json={"product_id": p_a["id"], "transaction_type": "DAMAGE", "quantity": 3, "notes": "Broken bottles"},
            headers=self.owner_a_headers,
        )
        assert_stock_synced(24.0)

        self.client.post(
            "/api/purchases",
            json={
                "supplier_name": "Agro Dist",
                "bill_number": "PUR-SYNC-1",
                "items": [{"product_id": p_a["id"], "batch_number": "CHL-01", "quantity": 6, "purchase_price": 100, "gst_rate": 18}],
            },
            headers=self.owner_a_headers,
        )
        assert_stock_synced(30.0)

    # ── Phase 3 Production Hardening: Multi-tenant return_number, CSRF Origin, Idempotency Race, Migrations & Seed ──
    def test_phase3_production_hardening(self):
        from sqlalchemy.exc import IntegrityError
        from app.database.migrations import _drop_legacy_global_unique_indexes, _exec_savepoint

        # 1. Multi-tenant SalesReturn.return_number: Shop A & Shop B both create RET-YYYYMMDD-0001 on same day
        pa = self.client.post(
            "/api/products",
            json={"product_name": "ShopA Urea", "category": "Fertilizer", "unit": "Bags", "purchase_price": "200", "selling_price": "300", "gst_rate": "5", "current_stock": "10"},
            headers=self.owner_a_headers,
        ).json()
        pb = self.client.post(
            "/api/products",
            json={"product_name": "ShopB Urea", "category": "Fertilizer", "unit": "Bags", "purchase_price": "200", "selling_price": "300", "gst_rate": "5", "current_stock": "10"},
            headers=self.owner_b_headers,
        ).json()
        sa = self.client.post(
            "/api/sales",
            json={"items": [{"product_id": pa["id"], "product_name": pa["product_name"], "quantity": 2, "price": 300, "gst_rate": 5}]},
            headers=self.owner_a_headers,
        ).json()
        sb = self.client.post(
            "/api/sales",
            json={"items": [{"product_id": pb["id"], "product_name": pb["product_name"], "quantity": 2, "price": 300, "gst_rate": 5}]},
            headers=self.owner_b_headers,
        ).json()

        ret_a = self.client.post(
            "/api/returns",
            json={"sale_id": sa["id"], "invoice_number": sa["invoice_number"], "items": [{"sale_item_id": sa["items"][0]["id"], "returned_quantity": 1}]},
            headers=self.owner_a_headers,
        )
        ret_b = self.client.post(
            "/api/returns",
            json={"sale_id": sb["id"], "invoice_number": sb["invoice_number"], "items": [{"sale_item_id": sb["items"][0]["id"], "returned_quantity": 1}]},
            headers=self.owner_b_headers,
        )
        self.assertEqual(ret_a.status_code, 201, ret_a.text)
        self.assertEqual(ret_b.status_code, 201, ret_b.text)
        self.assertTrue(ret_a.json()["return_number"].endswith("-00001"))
        self.assertTrue(ret_b.json()["return_number"].endswith("-00001"))
        # Verify composite (shop_id, return_number) index allows identical return_number across shops
        from app.models.models import SalesReturn
        db_ret = self.TestingSessionLocal()
        try:
            db_ret.add_all([
                SalesReturn(shop_id=self.shop_a_id, return_number="RET-SHARED-001", sale_id=sa["id"], invoice_number=sa["invoice_number"]),
                SalesReturn(shop_id=self.shop_b_id, return_number="RET-SHARED-001", sale_id=sb["id"], invoice_number=sb["invoice_number"]),
            ])
            db_ret.commit()
        finally:
            db_ret.close()

        # 2. Defense-in-depth CSRF Origin check on cookie-authenticated mutations
        tok, code = _make_signed_captcha(nonce="33333333333333333333333333333333")
        login_res = self.client.post(
            "/api/auth/login",
            json={"username": "owner_a", "password": "AlphaPass#1", "captcha_token": tok, "captcha_code": code},
        )
        cookie_jwt = login_res.json()["access_token"]
        self.client.cookies.set("access_token", cookie_jwt)
        try:
            csrf_blocked = self.client.post(
                "/api/expenses",
                json={"category": "Rent", "amount": 100, "description": "CSRF attempt"},
                headers={"Origin": "https://evil-attacker.example"},
            )
            self.assertEqual(csrf_blocked.status_code, 403)
            self.assertIn("CSRF", csrf_blocked.json()["detail"])

            csrf_allowed = self.client.post(
                "/api/expenses",
                json={"category": "Rent", "amount": 100, "description": "Legit browser save"},
                headers={"Origin": "https://nockbill.com"},
            )
            self.assertEqual(csrf_allowed.status_code, 201, csrf_allowed.text)
        finally:
            self.client.cookies.clear()

        # 3. Concurrent idempotency_key IntegrityError replays existing sale instead of returning 500
        race_key = "sale-race-replay-key-999"
        first_sale = self.client.post(
            "/api/sales",
            json={
                "idempotency_key": race_key,
                "items": [{"product_id": pa["id"], "product_name": pa["product_name"], "quantity": 1, "price": 300, "gst_rate": 5}],
            },
            headers=self.owner_a_headers,
        )
        self.assertEqual(first_sale.status_code, 201)

        # Force initial lookup to miss and simulate concurrent unique-constraint collision on commit
        orig_first = None
        from sqlalchemy.orm import Query as SAQuery
        orig_first = SAQuery.first
        call_state = {"missed_once": False}

        def simulated_race_first(q_self):
            sql_text = str(q_self.statement)
            if not call_state["missed_once"] and "idempotency_key" in sql_text:
                call_state["missed_once"] = True
                return None
            return orig_first(q_self)

        with patch.object(SAQuery, "first", simulated_race_first):
            replayed = self.client.post(
                "/api/sales",
                json={
                    "idempotency_key": race_key,
                    "items": [{"product_id": pa["id"], "product_name": pa["product_name"], "quantity": 1, "price": 300, "gst_rate": 5}],
                },
                headers=self.owner_a_headers,
            )
        self.assertEqual(replayed.status_code, 201, replayed.text)
        self.assertEqual(replayed.json()["id"], first_sale.json()["id"])

        # 4. Migrations SAVEPOINT helper isolates benign DDL errors without aborting transaction
        with self.engine.begin() as conn:
            _exec_savepoint(conn, "DROP INDEX nonexistent_legacy_index_xyz")
            _drop_legacy_global_unique_indexes(conn, "sqlite")
        self.assertTrue(ensure_schema(self.engine, raise_on_error=True))

        # 5. seed.py runs cleanly end-to-end with explicit shop_id & demo_admin when SEED_DEMO_DATA=true
        import importlib
        import seed as seed_mod
        with tempfile.TemporaryDirectory() as seed_tmp:
            seed_engine = create_engine(
                f"sqlite:///{Path(seed_tmp) / 'seed_check.sqlite3'}",
                connect_args={"check_same_thread": False},
            )
            seed_session = sessionmaker(autocommit=False, autoflush=False, bind=seed_engine)
            try:
                with (
                    patch.object(seed_mod, "engine", seed_engine),
                    patch.object(seed_mod, "SessionLocal", seed_session),
                    patch.dict(os.environ, {"SEED_DEMO_DATA": "true", "SEED_ADMIN_PASSWORD": "StrongDemoPass#99"}),
                ):
                    seed_mod.seed()
                verify_db = seed_session()
                try:
                    self.assertEqual(verify_db.query(Product).count(), 10)
                    self.assertEqual(verify_db.query(Sale).count(), 1)
                    self.assertEqual(verify_db.query(Expense).count(), 3)
                finally:
                    verify_db.close()
            finally:
                seed_engine.dispose()

    def test_shop_management_iam_users_and_invoice_builder(self):
        # 1. Staff cannot list IAM users (403); Owner A lists only Shop A's IAM users
        self.assertEqual(
            self.client.get("/api/auth/users", headers=self.staff_a_headers).status_code,
            403,
        )
        list_res = self.client.get("/api/auth/users", headers=self.owner_a_headers)
        self.assertEqual(list_res.status_code, 200, list_res.text)
        usernames = [u["username"] for u in list_res.json()]
        self.assertIn("owner_a", usernames)
        self.assertIn("staff_a", usernames)
        self.assertNotIn("owner_b", usernames)
        self.assertEqual(list_res.json()[0]["shop_account_id"], "SHOP-00001")

        # 2. Owner A creates an IAM user
        with patch("app.routers.auth.send_welcome_account_email", return_value=True):
            create_res = self.client.post(
                "/api/auth/users",
                json={
                    "name": "Ravi Cashier",
                    "username": "Cashier_Ravi",
                    "password": "RaviPassword#1",
                    "phone": "9876500011",
                    "email": "ravi@alpha.example",
                    "role": "STAFF",
                },
                headers=self.owner_a_headers,
            )
        self.assertEqual(create_res.status_code, 201, create_res.text)
        ravi_id = create_res.json()["id"]
        self.assertEqual(create_res.json()["username"], "cashier_ravi")
        self.assertEqual(create_res.json()["shop_account_id"], "SHOP-00001")

        # 3. AWS Console-style IAM Login with Shop Account ID ("SHOP-00001") succeeds; wrong shop ("SHOP-00002") -> 401
        tok_wrong, code_wrong = _make_signed_captcha("I1A2M3", "102030405060708090a0b0c0d0e0f001")
        iam_wrong_shop = self.client.post(
            "/api/auth/login",
            json={
                "shop_account_id": "SHOP-00002",
                "username": "cashier_ravi",
                "password": "RaviPassword#1",
                "captcha_token": tok_wrong,
                "captcha_code": code_wrong,
            },
        )
        self.assertEqual(iam_wrong_shop.status_code, 401)

        tok_ok, code_ok = _make_signed_captcha("I4A5M6", "102030405060708090a0b0c0d0e0f002")
        iam_ok = self.client.post(
            "/api/auth/login",
            json={
                "shop_account_id": "SHOP-00001",
                "username": "cashier_ravi",
                "password": "RaviPassword#1",
                "captcha_token": tok_ok,
                "captcha_code": code_ok,
            },
        )
        self.assertEqual(iam_ok.status_code, 200, iam_ok.text)
        ravi_token = iam_ok.json()["access_token"]
        ravi_headers = {"Authorization": f"Bearer {ravi_token}"}
        self.assertEqual(self.client.get("/api/auth/me", headers=ravi_headers).status_code, 200)

        # 4. Cross-tenant protection: Owner B cannot edit or delete Owner A's IAM user (404)
        self.assertEqual(
            self.client.put(f"/api/auth/users/{ravi_id}", json={"name": "Hack"}, headers=self.owner_b_headers).status_code,
            404,
        )
        self.assertEqual(
            self.client.delete(f"/api/auth/users/{ravi_id}", headers=self.owner_b_headers).status_code,
            404,
        )

        # 5. Owner A cannot delete or deactivate their own active owner account (400)
        owner_a_id = next(u["id"] for u in list_res.json() if u["username"] == "owner_a")
        self.assertEqual(
            self.client.put(f"/api/auth/users/{owner_a_id}", json={"is_active": False}, headers=self.owner_a_headers).status_code,
            400,
        )
        self.assertEqual(
            self.client.delete(f"/api/auth/users/{owner_a_id}", headers=self.owner_a_headers).status_code,
            400,
        )

        # 6. Owner A updates Ravi's password -> Ravi's old JWT is immediately revoked (401)
        upd_res = self.client.put(
            f"/api/auth/users/{ravi_id}",
            json={"name": "Ravi Senior Cashier", "password": "RaviNewPassword#2"},
            headers=self.owner_a_headers,
        )
        self.assertEqual(upd_res.status_code, 200, upd_res.text)
        self.assertEqual(upd_res.json()["name"], "Ravi Senior Cashier")
        self.assertEqual(self.client.get("/api/auth/me", headers=ravi_headers).status_code, 401)

        # 7. Owner A deletes Ravi cleanly
        del_res = self.client.delete(f"/api/auth/users/{ravi_id}", headers=self.owner_a_headers)
        self.assertEqual(del_res.status_code, 200, del_res.text)

        # 8. Invoice Builder settings & Shop Logo Upload/Delete
        inv_upd = self.client.put(
            "/api/settings",
            json={
                "shop_name": "Alpha Agro Center",
                "invoice_template": "MODERN_CORPORATE",
                "invoice_accent_color": "#1d4ed8",
                "invoice_header_tagline": "Authorized IFFCO & Bayer Dealer",
                "invoice_footer_note": "Thank you Farmer! Visit again.",
                "invoice_signature_label": "Managing Partner",
                "invoice_show_logo": True,
                "invoice_show_licenses": True,
                "invoice_show_bank_details": True,
                "invoice_show_batch_expiry": False,
                "invoice_show_hsn": True,
            },
            headers=self.owner_a_headers,
        )
        self.assertEqual(inv_upd.status_code, 200, inv_upd.text)
        self.assertEqual(inv_upd.json()["invoice_template"], "MODERN_CORPORATE")
        self.assertEqual(inv_upd.json()["invoice_accent_color"], "#1d4ed8")
        self.assertFalse(inv_upd.json()["invoice_show_batch_expiry"])

        bad_logo = self.client.post(
            "/api/settings/logo",
            files={"file": ("bad.png", b"not-a-valid-png", "image/png")},
            headers=self.owner_a_headers,
        )
        self.assertEqual(bad_logo.status_code, 422)

        logo_res = self.client.post(
            "/api/settings/logo",
            files={"file": ("logo.png", _make_valid_png_bytes(), "image/png")},
            headers=self.owner_a_headers,
        )
        self.assertEqual(logo_res.status_code, 200, logo_res.text)
        self.assertTrue(logo_res.json()["logo_path"].startswith("data:image/png;base64,"))

        # Verify PDF generator renders with the uploaded data-URI logo & custom builder settings
        from app.reports.invoice_pdf import generate_invoice_pdf
        db = self.TestingSessionLocal()
        try:
            shop_a = db.query(ShopSettings).filter(ShopSettings.id == self.shop_a_id).first()
            dummy_sale = Sale(
                id=77,
                shop_id=self.shop_a_id,
                invoice_number="INV-202611-00077",
                customer_name="Farmer Test",
                payment_method="UPI",
                subtotal=Decimal("500.00"),
                gst_amount=Decimal("25.00"),
                grand_total=Decimal("525.00"),
            )
            pdf_bytes = generate_invoice_pdf(dummy_sale, shop_a)
            self.assertTrue(pdf_bytes.startswith(b"%PDF-"))
        finally:
            db.close()

        del_logo = self.client.delete("/api/settings/logo", headers=self.owner_a_headers)
        self.assertEqual(del_logo.status_code, 200)
        self.assertIsNone(del_logo.json()["logo_path"])

        # 9. Dynamic UPI QR Code & Khata / Onboarding / Compliance endpoints
        qr_res = self.client.get(
            "/api/settings/upi-qr?amount=1250.50&invoice_number=INV-101&upi_id=alpha@okaxis",
            headers=self.owner_a_headers,
        )
        self.assertEqual(qr_res.status_code, 200, qr_res.text)
        self.assertTrue(qr_res.json()["qr_svg_data_uri"].startswith("data:image/svg+xml;base64,"))
        self.assertIn("am=1250.50", qr_res.json()["upi_uri"])

        tpl_res = self.client.get("/api/khata/catalog-templates", headers=self.owner_a_headers)
        self.assertEqual(tpl_res.status_code, 200)
        self.assertGreaterEqual(len(tpl_res.json()["templates"]), 10)

        imp_res = self.client.post(
            "/api/khata/import-catalog",
            json={"codes": ["IFFCO-NANO-UREA", "FMC-CORAGEN-150ML"]},
            headers=self.owner_a_headers,
        )
        self.assertEqual(imp_res.status_code, 201, imp_res.text)
        self.assertEqual(imp_res.json()["imported_count"], 2)
        imported_id = imp_res.json()["imported_products"][0]["id"]

        clr_res = self.client.post(
            "/api/khata/expiry-clearance",
            json={"product_id": imported_id, "discount_percent": 10},
            headers=self.owner_a_headers,
        )
        self.assertEqual(clr_res.status_code, 200, clr_res.text)
        self.assertEqual(clr_res.json()["new_selling_price"], 202.5)

        # Create a CREDIT sale for Farmer Khata test
        credit_sale = self.client.post(
            "/api/sales",
            json={
                "customer_name": "Kisan Udhar",
                "customer_phone": "9876543210",
                "customer_address": "Niphad",
                "payment_method": "CREDIT",
                "items": [{"product_id": imported_id, "product_name": "IFFCO Nano Urea Liquid", "quantity": 2, "price": 200, "gst_rate": 5}],
            },
            headers=self.owner_a_headers,
        )
        self.assertEqual(credit_sale.status_code, 201, credit_sale.text)

        cust_khata = self.client.get("/api/khata/customers?only_due=true", headers=self.owner_a_headers)
        self.assertEqual(cust_khata.status_code, 200)
        self.assertEqual(cust_khata.json()["total_outstanding_udhar"], 400.0)

        lookup_res = self.client.get("/api/khata/customers/lookup?phone=9876543210", headers=self.owner_a_headers)
        self.assertEqual(lookup_res.status_code, 200)
        self.assertTrue(lookup_res.json()["found"])
        self.assertEqual(lookup_res.json()["outstanding_balance"], 400.0)

        pay_res = self.client.post(
            "/api/khata/payments",
            json={
                "ledger_type": "CUSTOMER",
                "party_name": "Kisan Udhar",
                "party_phone": "9876543210",
                "amount": 150,
                "payment_mode": "UPI",
                "notes": "Partial repayment",
            },
            headers=self.owner_a_headers,
        )
        self.assertEqual(pay_res.status_code, 201, pay_res.text)

        lookup_after = self.client.get("/api/khata/customers/lookup?phone=9876543210", headers=self.owner_a_headers)
        self.assertEqual(lookup_after.json()["outstanding_balance"], 250.0)

        self.assertEqual(self.client.get("/api/khata/suppliers", headers=self.owner_a_headers).status_code, 200)
        self.assertEqual(self.client.get("/api/khata/payments", headers=self.owner_a_headers).status_code, 200)
        self.assertEqual(self.client.get("/api/khata/shift-handover", headers=self.owner_a_headers).status_code, 200)
        comp_res = self.client.get("/api/khata/compliance-register", headers=self.owner_a_headers)
        self.assertEqual(comp_res.status_code, 200)
        self.assertGreaterEqual(len(comp_res.json()["stock_cum_price_board"]), 2)


if __name__ == "__main__":
    unittest.main()
