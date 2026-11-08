"""
Invoice PDF generation using ReportLab.
Supports both A4 and thermal (80mm wide) layouts.
"""
from io import BytesIO
from decimal import Decimal
from typing import List
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph,
    Spacer, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from reportlab.lib.colors import HexColor


GREEN = HexColor("#1B5E20")
LIGHT_GREEN = HexColor("#E8F5E9")
DARK_TEXT = HexColor("#212121")

styles = getSampleStyleSheet()


def _header_style(size=14, bold=True, color=GREEN, align=TA_CENTER):
    return ParagraphStyle(
        "custom",
        parent=styles["Normal"],
        fontSize=size,
        textColor=color,
        fontName="Helvetica-Bold" if bold else "Helvetica",
        alignment=align,
        spaceAfter=2,
    )


def generate_invoice_pdf(sale, shop) -> bytes:
    """
    Generate a PDF invoice for the given sale.
    Returns raw PDF bytes.
    """
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
    )

    elements = []

    # ── Shop Header ──────────────────────────────────────────
    elements.append(Paragraph(shop.shop_name or "NockBill Solutions", _header_style(18)))
    if shop.address:
        elements.append(Paragraph(shop.address, _header_style(9, bold=False, color=DARK_TEXT)))
    contact_parts = []
    if shop.phone:
        contact_parts.append(f"Phone: {shop.phone}")
    if shop.gstin:
        contact_parts.append(f"GSTIN: {shop.gstin}")
    if contact_parts:
        elements.append(Paragraph(" | ".join(contact_parts), _header_style(9, bold=False, color=DARK_TEXT)))

    elements.append(HRFlowable(width="100%", thickness=1.5, color=GREEN, spaceAfter=4))
    elements.append(Paragraph("<b>TAX INVOICE / RETAIL BILL</b>", _header_style(12, bold=True, color=GREEN)))
    elements.append(Spacer(1, 4))

    # ── Unique Billing Details ────────────────────────────────
    inv_num = sale.invoice_number or f"KSK-{sale.sale_date.strftime('%Y%m') if sale.sale_date else '202609'}-{sale.id:05d}"
    s_date_str = sale.sale_date.strftime('%d/%m/%Y %I:%M %p') if sale.sale_date else "-"
    pm_str = sale.payment_method.value if hasattr(sale.payment_method, "value") else str(sale.payment_method)
    if sale.notes and ("Split Payment:" in sale.notes or "Payment Split:" in sale.notes):
        clean_split = sale.notes.replace("Payment Split:", "").replace("Split Payment:", "").strip()
        pm_display = clean_split
    else:
        pm_display = pm_str

    invoice_data = [
        [
            Paragraph(f"<b>Bill / Invoice No:</b> <font color='#1B5E20'><b>{inv_num}</b></font>", styles["Normal"]),
            Paragraph(f"<b>Date & Time:</b> {s_date_str}", _header_style(9, align=TA_RIGHT, bold=False, color=DARK_TEXT)),
        ],
        [
            Paragraph(f"<b>Customer Name:</b> {sale.customer_name or 'Walk-in Farmer'}", styles["Normal"]),
            Paragraph(f"<b>Phone:</b> {sale.customer_phone or '-'}", _header_style(9, align=TA_RIGHT, bold=False, color=DARK_TEXT)),
        ],
        [
            Paragraph(f"<b>Payment Mode:</b> {pm_display} <font color='#2E7D32'>(PAID)</font>", styles["Normal"]),
            Paragraph(f"<b>Bill Ref ID:</b> #{sale.id:05d}", _header_style(9, align=TA_RIGHT, bold=False, color=DARK_TEXT)),
        ],
    ]

    elements.append(Table(invoice_data, colWidths=["55%", "45%"]))
    elements.append(Spacer(1, 6))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey, spaceAfter=4))

    # ── Line Items ───────────────────────────────────────────
    headers = ["#", "Product Description", "Net Content", "Qty", "Price ₹", "GST%", "GST ₹", "Total ₹"]
    rows = [headers]
    for i, item in enumerate(sale.items, 1):
        comp = f"\n<font color='#616161'>{item.company_name}</font>" if item.company_name else ""
        rows.append([
            str(i),
            f"{item.product_name}{comp}",
            item.net_content or "-",
            str(item.quantity),
            f"₹{item.price:,.2f}",
            f"{item.gst_rate}%",
            f"₹{item.gst_amount:,.2f}",
            f"₹{item.total:,.2f}",
        ])

    item_table = Table(
        rows,
        colWidths=[8 * mm, 55 * mm, 25 * mm, 12 * mm, 22 * mm, 15 * mm, 22 * mm, 22 * mm],
        repeatRows=1,
    )
    item_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), GREEN),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_GREEN]),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.lightgrey),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    elements.append(item_table)
    elements.append(Spacer(1, 6))

    # ── Totals & Tax Split ────────────────────────────────────
    half_gst = (sale.gst_amount or Decimal("0")) / Decimal("2")
    totals = [
        ["", "", "", "", "", "", "Taxable Amount:", f"₹{sale.subtotal:,.2f}"],
        ["", "", "", "", "", "", "CGST (50%):", f"₹{half_gst:,.2f}"],
        ["", "", "", "", "", "", "SGST (50%):", f"₹{half_gst:,.2f}"],
        ["", "", "", "", "", "", "Total GST:", f"₹{sale.gst_amount:,.2f}"],
        ["", "", "", "", "", "", "GRAND TOTAL:", f"₹{sale.grand_total:,.2f}"],
    ]
    totals_table = Table(
        totals,
        colWidths=[8 * mm, 55 * mm, 25 * mm, 12 * mm, 22 * mm, 15 * mm, 35 * mm, 22 * mm],
    )
    totals_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("FONTNAME", (6, 4), (7, 4), "Helvetica-Bold"),
        ("FONTSIZE", (6, 4), (7, 4), 9.5),
        ("ALIGN", (6, 0), (7, -1), "RIGHT"),
        ("LINEABOVE", (6, 4), (7, 4), 1, GREEN),
        ("TEXTCOLOR", (6, 4), (7, 4), GREEN),
    ]))
    elements.append(totals_table)

    elements.append(Spacer(1, 14))

    # ── Terms & Authorized Signatory ──────────────────────────
    footer_data = [
        [
            Paragraph("<b>Terms & Conditions:</b><br/>1. Certified quality products.<br/>2. Goods once sold will not be returned without bill.<br/>3. Subject to local jurisdiction.", _header_style(7, bold=False, color=colors.dimgrey, align=TA_LEFT)),
            Paragraph(f"For <b>{shop.shop_name or 'NockBill Solutions'}</b><br/><br/><br/><b>Authorized Signatory</b>", _header_style(8, bold=False, color=DARK_TEXT, align=TA_RIGHT)),
        ]
    ]
    footer_table = Table(footer_data, colWidths=["60%", "40%"])
    elements.append(footer_table)
    elements.append(Spacer(1, 8))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey))
    elements.append(Paragraph(
        "Thank you for shopping with us! Wishing you a prosperous harvest.",
        _header_style(8, bold=False, color=colors.grey),
    ))

    doc.build(elements)
    return buf.getvalue()


def generate_purchase_pdf(purchase, shop) -> bytes:
    """
    Generate a PDF for an inward purchase bill / goods receipt note.
    Returns raw PDF bytes.
    """
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
    )

    elements = []

    # ── Shop Header ──────────────────────────────────────────
    elements.append(Paragraph(shop.shop_name or "Fertilizer Shop", _header_style(18)))
    if shop.address:
        elements.append(Paragraph(shop.address, _header_style(9, bold=False, color=DARK_TEXT)))
    if shop.phone:
        elements.append(Paragraph(f"Phone: {shop.phone}", _header_style(9, bold=False, color=DARK_TEXT)))
    if shop.gstin:
        elements.append(Paragraph(f"GSTIN: {shop.gstin}", _header_style(9, bold=False, color=DARK_TEXT)))

    elements.append(HRFlowable(width="100%", thickness=1, color=HexColor("#1565C0"), spaceAfter=4))
    elements.append(Paragraph("<b>GOODS INWARD & PURCHASE RECEIPT</b>", _header_style(12, bold=True, color=HexColor("#1565C0"))))
    elements.append(Spacer(1, 4))

    # ── Bill Details ──────────────────────────────────────────
    p_date = purchase.purchase_date.strftime('%d/%m/%Y %I:%M %p') if purchase.purchase_date else "-"
    inv_num = purchase.invoice_number or f"PO-{purchase.id}"
    supp_name = purchase.supplier_name or "Direct Supplier / Depot"

    purchase_data = [
        [
            Paragraph(f"<b>Inward / Bill No:</b> {inv_num}", styles["Normal"]),
            Paragraph(f"<b>Date:</b> {p_date}", _header_style(9, align=TA_RIGHT)),
        ],
        [
            Paragraph(f"<b>Supplier:</b> {supp_name}", styles["Normal"]),
            Paragraph("<b>Type:</b> Stock Refill / Inward Entry", _header_style(9, align=TA_RIGHT)),
        ]
    ]

    elements.append(Table(purchase_data, colWidths=["55%", "45%"]))
    elements.append(Spacer(1, 6))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey, spaceAfter=4))

    # ── Items Table ───────────────────────────────────────────
    headers = ["#", "Product Name", "Unit / Batch", "Qty", "Cost Price", "GST%", "Total ₹"]
    rows = [headers]
    for i, item in enumerate(purchase.items, 1):
        p_name = item.product_name or (item.product.product_name if getattr(item, "product", None) else f"Product #{item.product_id}")
        u_info = f"{item.unit or ''}"
        if item.batch_number:
            u_info += f"\nB: {item.batch_number}"
        if item.expiry_date:
            u_info += f" Exp: {item.expiry_date}"

        rows.append([
            str(i),
            p_name,
            u_info.strip() or "-",
            str(item.quantity),
            f"₹{item.purchase_price:,.2f}",
            f"{item.gst_rate}%",
            f"₹{item.total:,.2f}",
        ])

    item_table = Table(
        rows,
        colWidths=[8 * mm, 60 * mm, 35 * mm, 16 * mm, 23 * mm, 16 * mm, 22 * mm],
        repeatRows=1,
    )
    item_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HexColor("#1565C0")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, HexColor("#E3F2FD")]),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.lightgrey),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    elements.append(item_table)
    elements.append(Spacer(1, 6))

    # ── Totals ───────────────────────────────────────────────
    totals = [
        ["", "", "", "", "", "Subtotal:", f"₹{purchase.subtotal:,.2f}"],
        ["", "", "", "", "", "GST Amount:", f"₹{purchase.gst_amount:,.2f}"],
        ["", "", "", "", "", "GRAND TOTAL:", f"₹{purchase.grand_total:,.2f}"],
    ]
    totals_table = Table(
        totals,
        colWidths=[8 * mm, 60 * mm, 35 * mm, 16 * mm, 18 * mm, 21 * mm, 22 * mm],
    )
    totals_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("FONTNAME", (4, 2), (6, 2), "Helvetica-Bold"),
        ("ALIGN", (4, 0), (6, -1), "RIGHT"),
        ("LINEABOVE", (4, 2), (6, 2), 1, HexColor("#1565C0")),
        ("TEXTCOLOR", (4, 2), (6, 2), HexColor("#1565C0")),
    ]))
    elements.append(totals_table)

    if purchase.notes:
        elements.append(Spacer(1, 6))
        elements.append(Paragraph(f"<b>Notes:</b> {purchase.notes}", styles["Normal"]))

    elements.append(Spacer(1, 14))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey))
    elements.append(Paragraph(
        f"Stock verified and entered into {shop.shop_name or 'NockBill Solutions'} inventory.",
        _header_style(9, bold=False, color=colors.grey),
    ))

    doc.build(elements)
    return buf.getvalue()

