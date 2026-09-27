from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    # Application
    app_name: str = "Fertilizer Shop Manager"
    app_version: str = "1.0.0"
    debug: bool = False
    secret_key: str = "change-me"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440

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

# Ensure upload directory exists
os.makedirs(settings.upload_dir, exist_ok=True)
