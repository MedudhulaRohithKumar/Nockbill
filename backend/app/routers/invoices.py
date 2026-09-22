"""
Invoice download routes (PDF + Excel export wrappers).
"""
import csv
import io
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.database.base import get_db
from app.models.models import Sale, ShopSettings, User
from app.reports.invoice_pdf import generate_invoice_pdf
from app.reports.excel_export import export_gst_report_excel, export_stock_report_excel
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/invoices", tags=["Invoices"])


@router.get("/{sale_id}/pdf")
def download_invoice_pdf(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(404, "Sale not found")
    shop = db.query(ShopSettings).first()
    if not shop:
        shop = ShopSettings(shop_name="My Fertilizer Shop")

    pdf_bytes = generate_invoice_pdf(sale, shop)
    filename = f"Invoice_{sale.invoice_number}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
