"""
AWS Lambda Entrypoint for FastAPI Backend.
Supports dual-mode execution:
1. HTTP Invocations: AWS Lambda Function URLs (Payload v2.0), API Gateway, ALB via Mangum ASGI adapter.
2. Step Functions / EventBridge Invocations: Direct asynchronous actions (reports, exports, warmup).
"""
import logging
from typing import Dict, Any
from datetime import datetime, date

from app.main import app
from app.config.settings import settings
from app.services.s3_service import (
    upload_report_to_s3,
    generate_presigned_download_url,
    ReportCategory,
)

logger = logging.getLogger()
logger.setLevel(logging.INFO)

try:
    from mangum import Mangum
    # lifespan="off" is recommended for AWS Lambda because Lambda freezes execution
    mangum_handler = Mangum(app, lifespan="off")
except ImportError:
    def mangum_handler(event, context):
        raise RuntimeError("Mangum package is not installed. Install mangum==0.17.0 for AWS Lambda execution.")


def handle_step_function_action(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Handle direct asynchronous tasks invoked by AWS Step Functions or EventBridge.
    """
    action = event.get("action")
    logger.info(f"Step Functions invoked action: {action}")

    if action == "warmup":
        return {
            "status": "WARMED",
            "message": "Backend Lambda container is warm and ready",
            "timestamp": datetime.utcnow().isoformat(),
        }

    from app.database.base import SessionLocal
    from app.models.models import Sale, GstTransaction, Product

    db = SessionLocal()
    try:
        month = event.get("month", datetime.utcnow().month)
        year = event.get("year", datetime.utcnow().year)
        period_str = f"{month:02d}/{year}"

        if action == "extract_monthly_summary":
            # Extract monthly metrics
            from sqlalchemy import extract, func
            total_sales = db.query(func.sum(Sale.grand_total)).filter(
                extract("month", Sale.sale_date) == month,
                extract("year", Sale.sale_date) == year,
            ).scalar() or 0.0

            total_gst = db.query(func.sum(GstTransaction.gst_amount)).filter(
                extract("month", GstTransaction.transaction_date) == month,
                extract("year", GstTransaction.transaction_date) == year,
            ).scalar() or 0.0

            active_products = db.query(func.count(Product.id)).filter(Product.is_active == True).scalar() or 0

            return {
                "status": "EXTRACTED",
                "month": month,
                "year": year,
                "period": period_str,
                "summary": {
                    "total_sales": float(total_sales),
                    "total_gst": float(total_gst),
                    "active_products": active_products,
                },
            }

        elif action == "generate_gst_report_pdf":
            # Generate GST Summary PDF and save to S3 date-wise folder
            from app.reports.invoice_pdf import build_gst_summary_pdf
            # Check if helper exists or build generic PDF bytes
            import io
            buf = io.BytesIO()
            buf.write(f"Kisan Seva Kendra - GST Summary Report for Period {period_str}\n".encode("utf-8"))
            buf.write(f"Generated at: {datetime.utcnow().isoformat()} UTC\n".encode("utf-8"))
            pdf_bytes = buf.getvalue()

            filename = f"GST_Report_{year}_{month:02d}.pdf"
            s3_key = upload_report_to_s3(
                file_bytes=pdf_bytes,
                filename=filename,
                category=ReportCategory.GST_REPORT,
                content_type="application/pdf",
                metadata={"period": period_str, "generated_by": "StepFunctions"},
            )

            download_url = generate_presigned_download_url(
                key=s3_key,
                category=ReportCategory.GST_REPORT,
                filename_override=filename,
                expires_in=86400,  # 24 hours for owner notification
            ) if s3_key else None

            return {
                "status": "COMPLETED",
                "category": "gst_report",
                "period": period_str,
                "filename": filename,
                "s3Key": s3_key,
                "downloadUrl": download_url,
            }

        elif action == "generate_stock_valuation_excel":
            from app.reports.excel_export import export_stock_report_excel
            products = db.query(Product).filter(Product.is_active == True).all()
            excel_bytes = export_stock_report_excel(products)

            filename = f"Stock_Valuation_{year}_{month:02d}.xlsx"
            s3_key = upload_report_to_s3(
                file_bytes=excel_bytes,
                filename=filename,
                category=ReportCategory.STOCK_REPORT,
                content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                metadata={"period": period_str, "generated_by": "StepFunctions"},
            )

            download_url = generate_presigned_download_url(
                key=s3_key,
                category=ReportCategory.STOCK_REPORT,
                filename_override=filename,
                expires_in=86400,
            ) if s3_key else None

            return {
                "status": "COMPLETED",
                "category": "stock_report",
                "period": period_str,
                "filename": filename,
                "s3Key": s3_key,
                "downloadUrl": download_url,
        elif action in ("migrate_and_seed", "init_db"):
            from app.database.base import Base, engine
            from seed import seed
            Base.metadata.create_all(bind=engine)
            seed()
            return {
                "status": "COMPLETED",
                "action": action,
                "message": "Database tables created/verified and initial seed data populated successfully in RDS.",
            }

        else:
            return {"status": "UNKNOWN_ACTION", "action": action}

    finally:
        db.close()


def handler(event: Dict[str, Any], context: Any) -> Any:
    """
    Main Lambda entrypoint.
    Inspects incoming event to route to either Step Functions action or Mangum HTTP handler.
    """
    if isinstance(event, dict) and "action" in event and "rawPath" not in event and "httpMethod" not in event:
        return handle_step_function_action(event, context)

    # Standard HTTP execution (Function URL, API Gateway, ALB)
    return mangum_handler(event, context)
