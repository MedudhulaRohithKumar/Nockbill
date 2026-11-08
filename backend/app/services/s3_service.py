"""
AWS S3 Service for storing and retrieving reports & invoices.
Organizes files into dedicated buckets per report type with date-wise folders:
  s3://<bucket>/YYYY/MM/DD/<filename>
Provides presigned URLs for secure browser downloads.
"""
import logging
import os
from datetime import datetime, date
from typing import Optional, Tuple
import io

from app.config.settings import settings

logger = logging.getLogger(__name__)

# Lazy initialized boto3 client
_s3_client = None


def get_s3_client():
    global _s3_client
    if _s3_client is None:
        try:
            import boto3
            client_kwargs = {"region_name": settings.aws_region}
            access_key = (settings.aws_access_key_id or "").strip()
            secret_key = (settings.aws_secret_access_key or "").strip()
            session_token = (
                getattr(settings, "aws_session_token", "")
                or os.environ.get("AWS_SESSION_TOKEN")
                or os.environ.get("AWS_SECURITY_TOKEN")
                or ""
            ).strip()
            if access_key and secret_key:
                client_kwargs["aws_access_key_id"] = access_key
                client_kwargs["aws_secret_access_key"] = secret_key
                if session_token:
                    client_kwargs["aws_session_token"] = session_token
            elif session_token:
                client_kwargs["aws_session_token"] = session_token
            _s3_client = boto3.client("s3", **client_kwargs)
        except Exception as e:
            logger.warning(f"Could not initialize boto3 S3 client: {e}")
            _s3_client = None
    return _s3_client


class ReportCategory:
    SALES_INVOICE = "sales_invoice"
    PURCHASE_BILL = "purchase_bill"
    GST_REPORT = "gst_report"
    STOCK_REPORT = "stock_report"


def get_bucket_for_category(category: str) -> str:
    """Resolve bucket name based on the report category."""
    mapping = {
        ReportCategory.SALES_INVOICE: settings.s3_invoices_bucket,
        ReportCategory.PURCHASE_BILL: settings.s3_purchases_bucket,
        ReportCategory.GST_REPORT: settings.s3_gst_reports_bucket,
        ReportCategory.STOCK_REPORT: settings.s3_stock_reports_bucket,
    }
    return mapping.get(category, settings.s3_invoices_bucket)


def build_date_wise_key(
    filename: str,
    file_date: Optional[datetime] = None,
    shop_id: Optional[int] = None,
    record_id: Optional[int] = None,
) -> str:
    """
    Build customer document S3 key hierarchy:
      shops/<shop_id>/records/<record_id>/YYYY/MM/DD/<filename>
    Fallback for general exports (without shop_id and record_id):
      YYYY/MM/DD/<filename>
    """
    dt = file_date or datetime.utcnow()
    year = dt.strftime("%Y")
    month = dt.strftime("%m")
    day = dt.strftime("%d")
    clean_name = filename.strip().replace(" ", "_")
    if shop_id is not None and record_id is not None:
        return f"shops/{shop_id}/records/{record_id}/{year}/{month}/{day}/{clean_name}"
    elif shop_id is not None:
        return f"shops/{shop_id}/{year}/{month}/{day}/{clean_name}"
    return f"{year}/{month}/{day}/{clean_name}"


def upload_report_to_s3(
    file_bytes: bytes,
    filename: str,
    category: str = ReportCategory.SALES_INVOICE,
    content_type: str = "application/pdf",
    file_date: Optional[datetime] = None,
    metadata: Optional[dict] = None,
    shop_id: Optional[int] = None,
    record_id: Optional[int] = None,
    key_override: Optional[str] = None,
) -> Optional[str]:
    """
    Upload report to the designated S3 bucket under scoped folder.
    Returns the S3 object key or None if S3 is not active.
    """
    if not settings.s3_enabled:
        return None

    s3 = get_s3_client()
    if not s3:
        return None

    bucket = get_bucket_for_category(category)
    key = key_override or build_date_wise_key(filename, file_date, shop_id=shop_id, record_id=record_id)

    extra_args = {
        "ContentType": content_type,
        "ServerSideEncryption": "AES256",
    }
    if metadata:
        extra_args["Metadata"] = {str(k): str(v) for k, v in metadata.items()}

    try:
        s3.put_object(
            Bucket=bucket,
            Key=key,
            Body=file_bytes,
            **extra_args,
        )
        logger.info(f"Successfully uploaded {filename} to s3://{bucket}/{key}")
        return key
    except Exception as e:
        logger.error(f"Failed to upload report to S3 (bucket: {bucket}, key: {key}): {e}")
        return None


def generate_presigned_download_url(
    key: str,
    category: str = ReportCategory.SALES_INVOICE,
    filename_override: Optional[str] = None,
    expires_in: Optional[int] = None,
) -> Optional[str]:
    """
    Generate an S3 presigned URL for downloading a report.
    Valid for settings.s3_presigned_url_expire_seconds (default 15 minutes).
    """
    s3 = get_s3_client()
    if not s3:
        return None

    bucket = get_bucket_for_category(category)
    expiration = expires_in or settings.s3_presigned_url_expire_seconds

    params = {"Bucket": bucket, "Key": key}
    if filename_override:
        params["ResponseContentDisposition"] = f'attachment; filename="{filename_override}"'

    try:
        url = s3.generate_presigned_url(
            "get_object",
            Params=params,
            ExpiresIn=expiration,
        )
        return url
    except Exception as e:
        logger.error(f"Failed to generate presigned URL for s3://{bucket}/{key}: {e}")
        return None


def check_report_exists_in_s3(
    key: str,
    category: str = ReportCategory.SALES_INVOICE,
) -> bool:
    """Check if report exists in S3 (useful for caching)."""
    s3 = get_s3_client()
    if not s3:
        return False
    bucket = get_bucket_for_category(category)
    try:
        s3.head_object(Bucket=bucket, Key=key)
        return True
    except Exception:
        return False
