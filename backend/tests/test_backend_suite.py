"""
Comprehensive unit and integration test suite for the NockBill Backend.
Tests helpers, OCR extraction, hybrid cookie/Bearer authentication,
timezone-aware UTC timestamps, and FastAPI routers.
"""
import sys
import unittest
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.utils.helpers import (
    normalize_date,
    normalize_price,
    normalize_net_content,
    generate_invoice_number,
    sanitize_text,
    sanitize_code,
    validate_phone,
    validate_pincode,
    validate_ifsc,
    validate_gstin,
    resolve_trade_name,
)
from app.ocr.ocr_service import (
    extract_product_details,
    _find_product_name,
    _find_batch_number,
    _find_price,
    _find_net_content,
    _find_date,
    _find_company,
    _find_hsn,
    _find_gst,
)


class TestHelpersUnit(unittest.TestCase):
    def test_normalize_date_formats(self):
        self.assertIsNone(normalize_date(""))
        self.assertEqual(normalize_date("15/08/2026"), "2026-08-15")
        self.assertEqual(normalize_date("15-08-2026"), "2026-08-15")
        self.assertEqual(normalize_date("2026-05-15"), "2026-05-15")
        self.assertEqual(normalize_date("2026/05"), "2026-05")
        self.assertEqual(normalize_date("05/2026"), "2026-05")
        self.assertEqual(normalize_date("05-2026"), "2026-05")
        self.assertEqual(normalize_date("May 2026"), "2026-05")
        self.assertEqual(normalize_date("December 2027"), "2027-12")
        self.assertIsNone(normalize_date("not-a-date"))

    def test_normalize_price(self):
        self.assertIsNone(normalize_price(""))
        self.assertIsNone(normalize_price("abc"))
        self.assertEqual(normalize_price("MRP ₹500"), Decimal("500"))
        self.assertEqual(normalize_price("Rs. 450.50"), Decimal("450.50"))
        self.assertEqual(normalize_price("1266.50"), Decimal("1266.50"))

    def test_normalize_net_content(self):
        self.assertEqual(normalize_net_content(""), (None, None))
        self.assertEqual(normalize_net_content("unknown"), (None, None))
        self.assertEqual(normalize_net_content("500 ML"), (Decimal("500"), "ml"))
        self.assertEqual(normalize_net_content("1 LITRE"), (Decimal("1"), "liter"))
        self.assertEqual(normalize_net_content("2 LITERS"), (Decimal("2"), "liter"))
        self.assertEqual(normalize_net_content("5 LTRS"), (Decimal("5"), "liter"))
        self.assertEqual(normalize_net_content("45 KG"), (Decimal("45"), "kg"))
        self.assertEqual(normalize_net_content("500 GRAMS"), (Decimal("500"), "gram"))
        self.assertEqual(normalize_net_content("250 GMS"), (Decimal("250"), "gram"))
        self.assertEqual(normalize_net_content("2L"), (Decimal("2"), "liter"))
        self.assertEqual(normalize_net_content("100 G"), (Decimal("100"), "gram"))

    def test_generate_invoice_number(self):
        dt = datetime(2026, 11, 15, tzinfo=timezone.utc)
        self.assertEqual(generate_invoice_number("KSK", 42, dt), "KSK-202611-00042")

    def test_sanitizers_and_validators(self):
        self.assertIsNone(sanitize_text(None))
        self.assertEqual(
            sanitize_text("  <b>IFFCO</b>   Neem  Urea  "),
            "IFFCO Neem Urea",
        )
        self.assertEqual(
            sanitize_text("Line 1\n\n  Line   2 ", allow_newlines=True),
            "Line 1\nLine 2",
        )
        self.assertEqual(len(sanitize_text("x" * 300, max_length=50)), 50)
        self.assertIsNone(sanitize_code(None))
        self.assertEqual(sanitize_code("   "), "")
        self.assertEqual(sanitize_code("batch#2026/01!", uppercase=True), "BATCH#2026/01")

        self.assertIsNone(validate_phone(None))
        self.assertEqual(validate_phone("+91 98765-43210"), "9876543210")
        self.assertEqual(validate_phone("919876543210"), "9876543210")
        self.assertEqual(validate_phone("09876543210"), "9876543210")
        with self.assertRaises(ValueError):
            validate_phone("12345")

        self.assertIsNone(validate_pincode(None))
        self.assertEqual(validate_pincode(" 422001 "), "422001")
        with self.assertRaises(ValueError):
            validate_pincode("012345")

        self.assertIsNone(validate_ifsc(None))
        self.assertEqual(validate_ifsc("sbin0001234"), "SBIN0001234")
        with self.assertRaises(ValueError):
            validate_ifsc("INVALID")

        self.assertIsNone(validate_gstin(None))
        self.assertEqual(validate_gstin("24AABCI1234E1Z0"), "24AABCI1234E1Z0")
        with self.assertRaises(ValueError):
            validate_gstin("A!")

    def test_resolve_trade_name(self):
        self.assertEqual(
            resolve_trade_name("Imidacloprid 17.8% SL", "Bayer"),
            "Confidor",
        )
        self.assertEqual(
            resolve_trade_name("Imidacloprid 17.8% SL", "Tata Rallis"),
            "Tatamida",
        )
        self.assertEqual(
            resolve_trade_name("Custom Micronutrient", "Acme Agri"),
            "Acme Agri Custom Micronutrient",
        )
        self.assertEqual(
            resolve_trade_name("Urea", "IFFCO", "Explicit Trade"),
            "Explicit Trade",
        )
        self.assertEqual(resolve_trade_name("OnlyProduct", None), "OnlyProduct")
        self.assertIsNone(resolve_trade_name(None, None))


class TestOcrServiceUnit(unittest.TestCase):
    def test_extract_product_details_full(self):
        sample_text = (
            "IFFCO NEEM COATED UREA\n"
            "BATCH NO: NCU-2026-09\n"
            "NET WT: 45 KG\n"
            "M.R.P. INCL ALL TAXES RS. 266.50\n"
            "MFG DATE: 08/2026\n"
            "EXPIRY DATE: 07/2028\n"
            "HSN CODE: 31021000\n"
            "GST: 5%\n"
        )
        res = extract_product_details(sample_text)
        self.assertIn("Urea", res.product_name)
        self.assertEqual(res.batch_number, "NCU-2026-09")
        self.assertEqual(res.unit, "Kg")
        self.assertAlmostEqual(res.price, 266.50, places=2)
        self.assertEqual(res.manufacture_date, "2026-08")
        self.assertEqual(res.expiry_date, "2028-07")
        self.assertEqual(res.hsn_code, "31021000")
        self.assertEqual(res.gst_rate, 5.0)

    def test_extract_product_details_fallbacks(self):
        empty_res = extract_product_details("")
        self.assertEqual(empty_res.product_name, "Scanned Product")

        brand_only, conf = _find_product_name("BAYER CROP SCIENCE\n12345")
        self.assertIn("BAYER", brand_only)
        self.assertGreaterEqual(conf, 0.75)

        prod_only, conf = _find_product_name("SAAF FUNGICIDE")
        self.assertEqual(prod_only, "Saaf Fungicide")

        generic_line, conf = _find_product_name("BATCH: 123\nSUPER BIO GRANULES")
        self.assertEqual(generic_line, "SUPER BIO GRANULES")

        self.assertEqual(_find_batch_number("LOT: ABC-12345")[0], "ABC-12345")
        self.assertEqual(_find_price("RATE: 850.00")[0], 850.0)
        self.assertEqual(_find_net_content("250 ML")[1], "Litres")
        self.assertEqual(_find_company("Acme Agro Industries Pvt Ltd")[0], "Acme Agro Industries Pvt Ltd")
        self.assertEqual(_find_hsn("DAP 18-46-0")[0], "31053000")
        self.assertEqual(_find_hsn("MOP POTASH")[0], "31042000")
        self.assertEqual(_find_hsn("NPK 19-19-19")[0], "31052000")
        self.assertEqual(_find_hsn("CONFIDOR INSECTICIDE")[0], "38089290")
        self.assertEqual(_find_gst("IGST: 18%")[0], 18.0)


class TestStaticSecurityAndCodeQuality(unittest.TestCase):
    def test_no_deprecated_utcnow_in_backend(self):
        app_dir = BACKEND_DIR / "app"
        for py_file in app_dir.rglob("*.py"):
            content = py_file.read_text(encoding="utf-8")
            self.assertNotIn(
                "datetime.utcnow",
                content,
                f"Deprecated datetime.utcnow found in {py_file}",
            )

    def test_hybrid_cookie_auth_present(self):
        auth_router = (BACKEND_DIR / "app" / "routers" / "auth.py").read_text(encoding="utf-8")
        auth_utils = (BACKEND_DIR / "app" / "utils" / "auth.py").read_text(encoding="utf-8")
        self.assertIn("def set_auth_cookie", auth_router)
        self.assertIn("httponly=True", auth_router)
        self.assertIn("def clear_auth_cookie", auth_router)
        self.assertIn("access_token: Optional[str] = Cookie(None)", auth_utils)

    def test_inventory_category_units_and_attributes_supported(self):
        products_router = (BACKEND_DIR / "app" / "routers" / "products.py").read_text(encoding="utf-8")
        models_file = (BACKEND_DIR / "app" / "models" / "models.py").read_text(encoding="utf-8")
        schemas_file = (BACKEND_DIR / "app" / "schemas" / "schemas.py").read_text(encoding="utf-8")

        for unit_token in ('"Pouches"', '"Tons"', '"Pieces"', '"Nos"', '"Sets"', '"Meters"', '"Rolls"', '"Grams"', '"Litre"'):
            self.assertIn(unit_token, products_router)
        self.assertIn("category_attributes = Column(Text", models_file)
        self.assertIn("category_attributes: Optional[Dict[str, Any]] = None", schemas_file)
        self.assertIn("def _sanitize_category_attributes", schemas_file)

    def test_lighthouse_bfcache_csp_and_session_endpoint(self):
        import importlib.util
        import os

        repo_root = BACKEND_DIR.parent
        auth_router = (BACKEND_DIR / "app" / "routers" / "auth.py").read_text(encoding="utf-8")
        self.assertIn('@router.get("/session")', auth_router)
        self.assertIn('_SESSION_HINT_COOKIE = "nb_auth_hint"', auth_router)

        cf_yaml = (repo_root / "infrastructure" / "cloudfront_custom_domain.yaml").read_text(encoding="utf-8")
        self.assertIn("SpaDocumentCachePolicy", cf_yaml)
        self.assertIn("require-trusted-types-for 'script'", cf_yaml)
        self.assertNotIn("cdn.jsdelivr.net", cf_yaml)

        spec = importlib.util.spec_from_file_location(
            "frontend_lambda_suite", str(repo_root / "frontend" / "lambda_handler.py")
        )
        mod = importlib.util.module_from_spec(spec)
        prev_origins = os.environ.get("ALLOWED_ORIGINS")
        try:
            os.environ["ALLOWED_ORIGINS"] = "https://nockbill.com"
            spec.loader.exec_module(mod)
            csp = mod.SECURITY_HEADERS["Content-Security-Policy"]
            self.assertNotIn("cdn.jsdelivr.net", csp)
            self.assertNotIn("apis.google.com", csp)
            self.assertIn("media-src 'self'", csp)
            self.assertIn("require-trusted-types-for 'script'", csp)
            self.assertEqual(mod.get_content_type("pos_3d.webp"), "image/webp")
            self.assertEqual(mod.get_content_type("hero-ambient.vtt"), "text/vtt; charset=utf-8")
            self.assertEqual(mod.get_content_type("site.webmanifest"), "application/manifest+json")

            if (repo_root / "frontend" / "dist" / "index.html").is_file():
                html_res = mod.handler({"requestContext": {"http": {"method": "GET", "path": "/"}}}, None)
                self.assertEqual(html_res["statusCode"], 200)
                self.assertNotIn("no-store", html_res["headers"]["Cache-Control"])
                self.assertIn("must-revalidate", html_res["headers"]["Cache-Control"])

                webp_res = mod.handler(
                    {"requestContext": {"http": {"method": "GET", "path": "/images/pos_3d.webp"}}},
                    None,
                )
                self.assertEqual(webp_res["statusCode"], 200)
                self.assertTrue(webp_res["isBase64Encoded"])
                self.assertEqual(webp_res["headers"]["Content-Type"], "image/webp")
        finally:
            if prev_origins is None:
                os.environ.pop("ALLOWED_ORIGINS", None)
            else:
                os.environ["ALLOWED_ORIGINS"] = prev_origins


if __name__ == "__main__":
    unittest.main()
