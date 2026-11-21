"""
AWS Lambda Entrypoint for FastAPI Backend.
Supports dual-mode execution:
1. HTTP Invocations: AWS Lambda Function URLs (Payload v2.0), API Gateway, ALB via Mangum ASGI adapter.
2. Step Functions / EventBridge Invocations: Direct asynchronous actions (tenant-isolated reports, exports, warmup, migrations).
"""
import io
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List

from sqlalchemy import extract, func

from app.main import app
from app.services.s3_service import (
    ReportCategory,
    generate_presigned_download_url,
    upload_report_to_s3,
)

logger = logging.getLogger()
logger.setLevel(logging.INFO)

try:
    from mangum import Mangum
    mangum_handler = Mangum(app, lifespan="off")
except ImportError:
    def mangum_handler(event, context):
        raise RuntimeError("Mangum package is not installed. Install mangum==0.17.0 for AWS Lambda execution.")


def _resolve_target_shops(db, event: Dict[str, Any]) -> List[Any]:
    """Return the exact ShopSettings rows to process so reports are strictly isolated per tenant (C2)."""
    from app.models.models import ShopSettings

    requested_shop_id = event.get("shop_id")
    if requested_shop_id is not None:
        shop = db.query(ShopSettings).filter(ShopSettings.id == int(requested_shop_id)).first()
        return [shop] if shop else []
    return db.query(ShopSettings).order_by(ShopSettings.id.asc()).all()


def _extract_shop_monthly_summary(db, shop_id: int, month: int, year: int) -> Dict[str, Any]:
    from app.models.models import GstTransaction, Product, Sale

    total_sales = db.query(func.sum(Sale.grand_total)).filter(
        Sale.shop_id == shop_id,
        extract("month", Sale.sale_date) == month,
        extract("year", Sale.sale_date) == year,
    ).scalar() or 0.0

    total_gst = db.query(func.sum(GstTransaction.gst_amount)).filter(
        GstTransaction.shop_id == shop_id,
        extract("month", GstTransaction.transaction_date) == month,
        extract("year", GstTransaction.transaction_date) == year,
    ).scalar() or 0.0

    active_products = db.query(func.count(Product.id)).filter(
        Product.shop_id == shop_id,
        Product.is_active == True,
    ).scalar() or 0

    return {
        "shop_id": shop_id,
        "total_sales": float(total_sales),
        "total_gst": float(total_gst),
        "active_products": int(active_products),
    }


def _generate_shop_gst_report(db, shop, month: int, year: int, period_str: str) -> Dict[str, Any]:
    summary = _extract_shop_monthly_summary(db, shop.id, month, year)
    buf = io.BytesIO()
    buf.write(f"{shop.shop_name} (Shop #{shop.id}) - GST Summary Report for Period {period_str}\n".encode("utf-8"))
    buf.write(f"Total Sales: INR {summary['total_sales']:.2f} | Total GST: INR {summary['total_gst']:.2f}\n".encode("utf-8"))
    buf.write(f"Generated at: {datetime.now(timezone.utc).isoformat()} UTC\n".encode("utf-8"))
    pdf_bytes = buf.getvalue()

    filename = f"GST_Report_Shop{shop.id}_{year}_{month:02d}.pdf"
    s3_key = upload_report_to_s3(
        file_bytes=pdf_bytes,
        filename=filename,
        category=ReportCategory.GST_REPORT,
        content_type="application/pdf",
        metadata={"period": period_str, "shop_id": str(shop.id), "generated_by": "StepFunctions"},
        shop_id=shop.id,
    )
    download_url = generate_presigned_download_url(
        key=s3_key,
        category=ReportCategory.GST_REPORT,
        filename_override=filename,
        expires_in=86400,
    ) if s3_key else None

    return {
        "shop_id": shop.id,
        "shop_name": shop.shop_name,
        "recipient_email": shop.email,
        "filename": filename,
        "s3Key": s3_key,
        "downloadUrl": download_url,
    }


def _generate_shop_stock_valuation(db, shop, month: int, year: int, period_str: str) -> Dict[str, Any]:
    from decimal import Decimal
    from app.models.models import Product
    from app.reports.excel_export import export_stock_report_excel
    from app.schemas.schemas import StockReportRow

    products = db.query(Product).filter(
        Product.shop_id == shop.id,
        Product.is_active == True,
    ).all()
    stock_rows = [
        StockReportRow(
            product_id=p.id,
            product_name=p.product_name,
            company_name=p.company_name,
            net_content=str(p.net_content) if p.net_content is not None else None,
            opening_stock=Decimal("0"),
            purchased=Decimal("0"),
            sold=Decimal("0"),
            returned=Decimal("0"),
            damaged=Decimal("0"),
            current_stock=Decimal(str(p.current_stock or 0)),
            minimum_stock=Decimal(str(p.minimum_stock or 0)),
            stock_value=Decimal(str(p.current_stock or 0)) * Decimal(str(p.selling_price or 0)),
        )
        for p in products
    ]
    excel_bytes = export_stock_report_excel(stock_rows)

    filename = f"Stock_Valuation_Shop{shop.id}_{year}_{month:02d}.xlsx"
    s3_key = upload_report_to_s3(
        file_bytes=excel_bytes,
        filename=filename,
        category=ReportCategory.STOCK_REPORT,
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        metadata={"period": period_str, "shop_id": str(shop.id), "generated_by": "StepFunctions"},
        shop_id=shop.id,
    )
    download_url = generate_presigned_download_url(
        key=s3_key,
        category=ReportCategory.STOCK_REPORT,
        filename_override=filename,
        expires_in=86400,
    ) if s3_key else None

    return {
        "shop_id": shop.id,
        "shop_name": shop.shop_name,
        "recipient_email": shop.email,
        "product_count": len(products),
        "filename": filename,
        "s3Key": s3_key,
        "downloadUrl": download_url,
    }


def handle_step_function_action(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Handle direct asynchronous tasks invoked by AWS Step Functions or EventBridge.
    Every tenant-scoped report iterates per shop_id and never combines data across tenants (C2).
    """
    action = event.get("action")
    logger.info("Step Functions invoked action: %s", action)

    if action == "warmup":
        return {
            "status": "WARMED",
            "message": "Backend Lambda container is warm and ready",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    if action in ("migrate_and_seed", "init_db"):
        from app.database.base import engine
        from app.database.migrations import ensure_schema
        from seed import seed

        ensure_schema(engine, raise_on_error=True)
        seed()
        return {
            "status": "COMPLETED",
            "action": action,
            "message": "Database tables and schema migrations verified successfully in RDS.",
        }

    from app.database.base import SessionLocal

    db = SessionLocal()
    try:
        month = int(event.get("month", datetime.now(timezone.utc).month))
        year = int(event.get("year", datetime.now(timezone.utc).year))
        period_str = f"{month:02d}/{year}"

        if action == "extract_monthly_summary":
            shops = _resolve_target_shops(db, event)
            if event.get("shop_id") is not None and not shops:
                return {"status": "NOT_FOUND", "shop_id": event.get("shop_id")}
            shop_summaries = [
                _extract_shop_monthly_summary(db, shop.id, month, year)
                for shop in shops
            ]
            result: Dict[str, Any] = {
                "status": "EXTRACTED",
                "month": month,
                "year": year,
                "period": period_str,
                "shops": shop_summaries,
            }
            if event.get("shop_id") is not None and shop_summaries:
                result["shop_id"] = shop_summaries[0]["shop_id"]
                result["summary"] = shop_summaries[0]
            return result

        if action == "generate_gst_report_pdf":
            shops = _resolve_target_shops(db, event)
            if event.get("shop_id") is not None and not shops:
                return {"status": "NOT_FOUND", "shop_id": event.get("shop_id")}
            reports = [
                _generate_shop_gst_report(db, shop, month, year, period_str)
                for shop in shops
            ]
            return {
                "status": "COMPLETED",
                "category": "gst_report",
                "period": period_str,
                "reports": reports,
            }

        if action == "generate_stock_valuation_excel":
            shops = _resolve_target_shops(db, event)
            if event.get("shop_id") is not None and not shops:
                return {"status": "NOT_FOUND", "shop_id": event.get("shop_id")}
            reports = [
                _generate_shop_stock_valuation(db, shop, month, year, period_str)
                for shop in shops
            ]
            return {
                "status": "COMPLETED",
                "category": "stock_report",
                "period": period_str,
                "reports": reports,
            }

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

    return mangum_handler(event, context)
