"""
Barcode Label PDF generation using ReportLab.
Supports exact label-sized thermal stickers (50x25mm, 50x30mm, 38x25mm)
as well as standard A4 multi-label sticker sheets (24 labels/page).
"""
from io import BytesIO
from typing import Optional
from decimal import Decimal
from reportlab.lib.units import mm
from reportlab.lib.pagesizes import A4
from reportlab.graphics.barcode import createBarcodeDrawing
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, PageBreak, Table, TableStyle, Spacer
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor, black, lightgrey


GREEN = HexColor("#1B5E20")
DARK = HexColor("#212121")


LABEL_SIZES = {
    "50x25": (50 * mm, 25 * mm),
    "50x30": (50 * mm, 30 * mm),
    "38x25": (38 * mm, 25 * mm),
    "2x1inch": (50.8 * mm, 25.4 * mm),
}


def generate_barcode_label_pdf(
    product_name: str,
    barcode: str,
    price: Decimal,
    gst_rate: Optional[Decimal] = Decimal("0"),
    shop_name: Optional[str] = "Kisan Seva Kendra",
    company_name: Optional[str] = None,
    net_content: Optional[str] = None,
    batch_number: Optional[str] = None,
    expiry_date: Optional[str] = None,
    label_size: str = "50x25",
    copies: int = 1,
    include_shop: bool = True,
    include_price: bool = True,
    include_batch: bool = False,
) -> bytes:
    """
    Generate an authentic barcode label PDF.
    If label_size == "a4_sheet", prints an A4 grid of 24 labels (3 cols x 8 rows).
    Otherwise, generates an exact label-sized PDF with `copies` pages (1 label per page).
    """
    clean_barcode = str(barcode).strip() or "10001"
    copies = max(1, min(copies, 100))

    styles = getSampleStyleSheet()
    buf = BytesIO()

    if label_size == "a4_sheet":
        doc = SimpleDocTemplate(
            buf,
            pagesize=A4,
            leftMargin=8 * mm,
            rightMargin=8 * mm,
            topMargin=10 * mm,
            bottomMargin=10 * mm,
        )

        p_shop = ParagraphStyle('A4Shop', parent=styles['Normal'], fontSize=6, leading=7, alignment=1, textColor=GREEN, fontName='Helvetica-Bold')
        p_prod = ParagraphStyle('A4Prod', parent=styles['Normal'], fontSize=6.5, leading=7.5, alignment=1, textColor=DARK, fontName='Helvetica-Bold')
        p_sub = ParagraphStyle('A4Sub', parent=styles['Normal'], fontSize=5.5, leading=6.5, alignment=1, textColor=DARK)

        def make_cell():
            elements = []
            if include_shop and shop_name:
                elements.append(Paragraph(shop_name[:28], p_shop))
            
            p_title = f"{product_name[:24]}"
            if net_content:
                p_title += f" ({net_content})"
            elements.append(Paragraph(p_title, p_prod))

            bc = createBarcodeDrawing(
                'Code128',
                value=clean_barcode,
                width=52 * mm,
                height=11 * mm,
                barWidth=0.26 * mm,
                barHeight=7.5 * mm,
                humanReadable=True,
                fontSize=5.5,
            )
            elements.append(bc)

            info_parts = []
            if include_price and price:
                info_parts.append(f"MRP: ₹{price:,.2f}")
            if include_batch and batch_number:
                info_parts.append(f"B: {batch_number}")
            if info_parts:
                elements.append(Paragraph(" | ".join(info_parts), p_sub))

            return elements

        grid = []
        for r in range(8):
            row = [make_cell() for _ in range(3)]
            grid.append(row)

        table = Table(grid, colWidths=[64 * mm, 64 * mm, 64 * mm], rowHeights=[34 * mm] * 8)
        table.setStyle(TableStyle([
            ('BOX', (0, 0), (-1, -1), 0.5, lightgrey),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, lightgrey),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ]))

        doc.build([table])
        return buf.getvalue()

    # Thermal / Label Sized PDF (exact label dimensions, 1 label per page)
    width, height = LABEL_SIZES.get(label_size, LABEL_SIZES["50x25"])
    
    doc = SimpleDocTemplate(
        buf,
        pagesize=(width, height),
        leftMargin=1 * mm,
        rightMargin=1 * mm,
        topMargin=1 * mm,
        bottomMargin=1 * mm,
    )

    is_compact = (height < 28 * mm)

    f_shop = 5.2 if is_compact else 5.8
    f_prod = 6.2 if is_compact else 7.0
    f_info = 5.0 if is_compact else 5.5
    bc_bar_height = 6.5 * mm if is_compact else 8.5 * mm

    p_shop = ParagraphStyle('ThShop', parent=styles['Normal'], fontSize=f_shop, leading=f_shop + 1, alignment=1, textColor=GREEN, fontName='Helvetica-Bold')
    p_prod = ParagraphStyle('ThProd', parent=styles['Normal'], fontSize=f_prod, leading=f_prod + 1, alignment=1, textColor=DARK, fontName='Helvetica-Bold')
    p_info = ParagraphStyle('ThInfo', parent=styles['Normal'], fontSize=f_info, leading=f_info + 1, alignment=1, textColor=DARK, fontName='Helvetica-Bold')

    story = []
    for i in range(copies):
        # 1. Shop Header
        if include_shop and shop_name:
            story.append(Paragraph(shop_name[:28], p_shop))

        # 2. Product Name
        prod_title = product_name[:24]
        if net_content and len(prod_title) < 18:
            prod_title += f" {net_content}"
        story.append(Paragraph(prod_title, p_prod))

        # 3. Code128 Barcode Graphic
        bc = createBarcodeDrawing(
            'Code128',
            value=clean_barcode,
            width=(width - 4 * mm),
            height=bc_bar_height + 3 * mm,
            barWidth=0.24 * mm,
            barHeight=bc_bar_height,
            humanReadable=True,
            fontSize=5.5,
        )
        story.append(bc)

        # 4. Price & Details
        details = []
        if include_price and price:
            details.append(f"MRP: ₹{price:,.2f}")
        if gst_rate and gst_rate > 0:
            details.append(f"GST {gst_rate}%")
        if include_batch and batch_number:
            details.append(f"B:{batch_number}")

        if details:
            story.append(Paragraph(" | ".join(details), p_info))

        # Page break between copies (each sticker is exactly 1 page)
        if i < copies - 1:
            story.append(PageBreak())

    doc.build(story)
    return buf.getvalue()
