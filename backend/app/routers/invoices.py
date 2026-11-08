"""
Invoice & Report download routes with AWS S3 date-wise storage and presigned URLs.
"""
import io
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse, RedirectResponse
from sqlalchemy.orm import Session

from app.config.settings import settings
from app.database.base import get_db
from app.models.models import Sale, Purchase, ShopSettings, User
from app.reports.invoice_pdf import generate_invoice_pdf, generate_purchase_pdf
from app.reports.excel_export import export_gst_report_excel, export_stock_report_excel
from app.services.s3_service import (
    upload_report_to_s3,
    generate_presigned_download_url,
    check_report_exists_in_s3,
    build_date_wise_key,
    ReportCategory,
)
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/invoices", tags=["Invoices"])


@router.get("/{sale_id}/pdf")
def download_invoice_pdf(
    sale_id: int,
    redirect_s3: bool = Query(False, description="Redirect to S3 presigned URL if S3 is enabled"),
    inline: bool = Query(True, description="Display inline in browser if true, or download if false"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sale = db.query(Sale).filter(Sale.id == sale_id, Sale.shop_id == current_user.shop_id).first()
    if not sale:
        raise HTTPException(404, "Sale not found")
    shop = db.query(ShopSettings).filter(ShopSettings.id == current_user.shop_id).first()
    if not shop:
        shop = ShopSettings(shop_name="NockBill Solutions")

    filename = f"Invoice_{sale.invoice_number}.pdf"
    file_date = sale.sale_date or datetime.utcnow()
    disposition = "inline" if inline else "attachment"

    # If S3 is enabled, upload to scoped customer folder and optionally redirect to presigned URL
    if settings.s3_enabled:
        key = build_date_wise_key(filename, file_date, shop_id=current_user.shop_id, record_id=sale.id)
        if not check_report_exists_in_s3(key, ReportCategory.SALES_INVOICE):
            pdf_bytes = generate_invoice_pdf(sale, shop)
            upload_report_to_s3(
                file_bytes=pdf_bytes,
                filename=filename,
                category=ReportCategory.SALES_INVOICE,
                content_type="application/pdf",
                file_date=file_date,
                metadata={"sale_id": str(sale.id), "invoice_number": sale.invoice_number, "shop_id": str(current_user.shop_id)},
                shop_id=current_user.shop_id,
                record_id=sale.id,
                key_override=key,
            )

        if redirect_s3:
            presigned_url = generate_presigned_download_url(
                key=key,
                category=ReportCategory.SALES_INVOICE,
                filename_override=filename,
            )
            if presigned_url:
                return RedirectResponse(url=presigned_url, status_code=307)

    # In-memory streaming fallback
    pdf_bytes = generate_invoice_pdf(sale, shop)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'{disposition}; filename="{filename}"',
            "Cache-Control": "private, max-age=3600",
        },
    )


@router.get("/{sale_id}/s3-url")
def get_invoice_s3_url(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate on-demand S3 presigned URL for an invoice."""
    sale = db.query(Sale).filter(Sale.id == sale_id, Sale.shop_id == current_user.shop_id).first()
    if not sale:
        raise HTTPException(404, "Sale not found")
    shop = db.query(ShopSettings).filter(ShopSettings.id == current_user.shop_id).first()
    if not shop:
        shop = ShopSettings(shop_name="NockBill Solutions")

    filename = f"Invoice_{sale.invoice_number}.pdf"
    file_date = sale.sale_date or datetime.utcnow()
    key = build_date_wise_key(filename, file_date, shop_id=current_user.shop_id, record_id=sale.id)

    if not check_report_exists_in_s3(key, ReportCategory.SALES_INVOICE):
        pdf_bytes = generate_invoice_pdf(sale, shop)
        upload_report_to_s3(
            file_bytes=pdf_bytes,
            filename=filename,
            category=ReportCategory.SALES_INVOICE,
            content_type="application/pdf",
            file_date=file_date,
            metadata={"sale_id": str(sale.id), "invoice_number": sale.invoice_number, "shop_id": str(current_user.shop_id)},
            shop_id=current_user.shop_id,
            record_id=sale.id,
            key_override=key,
        )

    presigned_url = generate_presigned_download_url(
        key=key,
        category=ReportCategory.SALES_INVOICE,
        filename_override=filename,
    )
    if not presigned_url:
        raise HTTPException(500, "S3 storage is not enabled or credentials unavailable.")

    return {
        "invoice_number": sale.invoice_number,
        "bucket": settings.s3_invoices_bucket,
        "key": key,
        "download_url": presigned_url,
        "expires_in_seconds": settings.s3_presigned_url_expire_seconds,
    }


@router.get("/purchase/{purchase_id}/pdf")
def download_purchase_pdf(
    purchase_id: int,
    redirect_s3: bool = Query(False, description="Redirect to S3 presigned URL if S3 is enabled"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    purchase = db.query(Purchase).filter(Purchase.id == purchase_id, Purchase.shop_id == current_user.shop_id).first()
    if not purchase:
        raise HTTPException(404, "Purchase not found")
    shop = db.query(ShopSettings).filter(ShopSettings.id == current_user.shop_id).first()
    if not shop:
        shop = ShopSettings(shop_name="NockBill Solutions")

    inv_name = purchase.invoice_number or f"PO-{purchase.id}"
    filename = f"Purchase_{inv_name}.pdf"
    file_date = purchase.purchase_date or datetime.utcnow()

    if settings.s3_enabled:
        key = build_date_wise_key(filename, file_date, shop_id=current_user.shop_id, record_id=purchase.id)
        if not check_report_exists_in_s3(key, ReportCategory.PURCHASE_BILL):
            pdf_bytes = generate_purchase_pdf(purchase, shop)
            upload_report_to_s3(
                file_bytes=pdf_bytes,
                filename=filename,
                category=ReportCategory.PURCHASE_BILL,
                content_type="application/pdf",
                file_date=file_date,
                metadata={"purchase_id": str(purchase.id), "shop_id": str(current_user.shop_id)},
                shop_id=current_user.shop_id,
                record_id=purchase.id,
                key_override=key,
            )

        if redirect_s3:
            presigned_url = generate_presigned_download_url(
                key=key,
                category=ReportCategory.PURCHASE_BILL,
                filename_override=filename,
            )
            if presigned_url:
                return RedirectResponse(url=presigned_url, status_code=307)

    pdf_bytes = generate_purchase_pdf(purchase, shop)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "private, max-age=3600",
        },
    )


@router.get("/purchase/{purchase_id}/s3-url")
def get_purchase_s3_url(
    purchase_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate on-demand S3 presigned URL for a purchase bill."""
    purchase = db.query(Purchase).filter(Purchase.id == purchase_id, Purchase.shop_id == current_user.shop_id).first()
    if not purchase:
        raise HTTPException(404, "Purchase not found")
    shop = db.query(ShopSettings).filter(ShopSettings.id == current_user.shop_id).first()
    if not shop:
        shop = ShopSettings(shop_name="NockBill Solutions")

    inv_name = purchase.invoice_number or f"PO-{purchase.id}"
    filename = f"Purchase_{inv_name}.pdf"
    file_date = purchase.purchase_date or datetime.utcnow()
    key = build_date_wise_key(filename, file_date, shop_id=current_user.shop_id, record_id=purchase.id)

    if not check_report_exists_in_s3(key, ReportCategory.PURCHASE_BILL):
        pdf_bytes = generate_purchase_pdf(purchase, shop)
        upload_report_to_s3(
            file_bytes=pdf_bytes,
            filename=filename,
            category=ReportCategory.PURCHASE_BILL,
            content_type="application/pdf",
            file_date=file_date,
            metadata={"purchase_id": str(purchase.id), "shop_id": str(current_user.shop_id)},
            shop_id=current_user.shop_id,
            record_id=purchase.id,
            key_override=key,
        )

    presigned_url = generate_presigned_download_url(
        key=key,
        category=ReportCategory.PURCHASE_BILL,
        filename_override=filename,
    )
    if not presigned_url:
        raise HTTPException(500, "S3 storage is not enabled or credentials unavailable.")

    return {
        "bill_number": inv_name,
        "bucket": settings.s3_purchases_bucket,
        "key": key,
        "download_url": presigned_url,
        "expires_in_seconds": settings.s3_presigned_url_expire_seconds,
    }
