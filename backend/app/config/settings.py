from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    # Application
    app_name: str = "NockBill Solutions"
    app_version: str = "1.0.0"
    debug: bool = False
    secret_key: str = ""
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440
    google_bridge_secret: str = ""
    subscription_payment_mode: str = "demo"

    def model_post_init(self, __context) -> None:
        key = (self.secret_key or "").strip()
        insecure_keys = ("change-me", "your-secret-key-here", "insecure-default", "secret", "password", "test")
        if not key or key.lower() in insecure_keys or len(key) < 32:
            env_mode = (os.environ.get("ENVIRONMENT") or "").lower()
            is_prod = env_mode in ("production", "prod") or (not self.debug and "localhost" not in self.database_url and "sqlite" not in self.database_url)
            if is_prod and not self.debug:
                raise RuntimeError(
                    "FATAL SECURITY CONFIGURATION ERROR: SECRET_KEY is not set or uses an insecure default in production. "
                    "You must provide a cryptographically secure SECRET_KEY (min 32 chars) via environment variable or Secrets Manager."
                )
            import secrets
            self.secret_key = secrets.token_urlsafe(32)

    # Database
    database_url: str = "sqlite:///./fertilizer_db.sqlite3"

    # CORS
    allowed_origins: str = "http://localhost:5173,http://localhost:3000"

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    # OCR
    ocr_provider: str = "tesseract"
    tesseract_cmd: str = "tesseract"
    google_application_credentials: str = ""
    azure_vision_endpoint: str = ""
    azure_vision_key: str = ""
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    # AWS & S3 Storage
    aws_region: str = "ap-south-1"
    s3_enabled: bool = False
    s3_invoices_bucket: str = "ks-sales-invoices"
    s3_purchases_bucket: str = "ks-purchase-bills"
    s3_gst_reports_bucket: str = "ks-gst-reports"
    s3_stock_reports_bucket: str = "ks-stock-reports"
    s3_presigned_url_expire_seconds: int = 900  # 15 minutes
    step_functions_arn_report_generator: str = ""
    frontend_function_url: str = ""

    # Amazon SES Email Settings
    ses_enabled: bool = True
    ses_sender_email: str = "admin@nockbill.com"
    ses_region: str = "ap-south-1"
    app_base_url: str = "https://nockbill.com"

    # Google OAuth
    google_client_id: str = "995123724994-6ejbal37p88sp32fmedph6k296uf8n7k.apps.googleusercontent.com"
    # Never hard-code secrets; supply via GOOGLE_CLIENT_SECRET env var if ever required.
    google_client_secret: str = ""

    # File Upload
    max_image_size_mb: int = 10
    upload_dir: str = "uploads"

    # Shop Defaults
    default_shop_name: str = "My Fertilizer Shop"
    default_currency: str = "INR"
    default_gst_rate: int = 18
    invoice_prefix: str = "INV"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()

# Ensure upload directory exists safely (in Lambda root /var/task is read-only)
try:
    os.makedirs(settings.upload_dir, exist_ok=True)
except OSError:
    pass

