"""
Credit Note / Sales Return PDF generation using ReportLab.
Professional tax-compliant credit memo for fertilizer and agro returns.
"""
from io import BytesIO
from decimal import Decimal
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


RED_ACCENT = HexColor("#B71C1C")
LIGHT_RED = HexColor("#FFEBEE")
GREEN = HexColor("#1B5E20")
DARK_TEXT = HexColor("#212121")

styles = getSampleStyleSheet()


def _header_style(size=14, bold=True, color=RED_ACCENT, align=TA_CENTER):
    return ParagraphStyle(
        "custom_return",
        parent=styles["Normal"],
        fontSize=size,
        textColor=color,
        fontName="Helvetica-Bold" if bold else "Helvetica",
        alignment=align,
        spaceAfter=2,
    )


def generate_sales_return_pdf(sales_return, shop) -> bytes:
    """
    Generate a Credit Note PDF for the given sales return.
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
    elements.append(Paragraph(shop.shop_name or "NockBill Solutions", _header_style(18, color=GREEN)))
    if shop.address:
        elements.append(Paragraph(shop.address, _header_style(9, bold=False, color=DARK_TEXT)))
    
    contact_parts = []
    if shop.phone:
        contact_parts.append(f"Phone: {shop.phone}")
    if shop.gstin:
        contact_parts.append(f"GSTIN: {shop.gstin}")
    if contact_parts:
        elements.append(Paragraph(" | ".join(contact_parts), _header_style(9, bold=False, color=DARK_TEXT)))

    elements.append(HRFlowable(width="100%", thickness=1.5, color=RED_ACCENT, spaceAfter=4))
    elements.append(Paragraph("<b>CREDIT NOTE / SALES RETURN MEMO</b>", _header_style(12, bold=True, color=RED_ACCENT)))
    elements.append(Spacer(1, 4))

    # ── Return & Invoice Meta Details ────────────────────────
    ret_num = sales_return.return_number
    ret_date_str = sales_return.return_date.strftime('%d/%m/%Y %I:%M %p') if sales_return.return_date else "-"
    pm_str = sales_return.refund_payment_method.value if hasattr(sales_return.refund_payment_method, "value") else str(sales_return.refund_payment_method)

    meta_data = [
        [
            Paragraph(f"<b>Credit Note No:</b> <font color='#B71C1C'><b>{ret_num}</b></font>", styles["Normal"]),
            Paragraph(f"<b>Return Date:</b> {ret_date_str}", _header_style(9, align=TA_RIGHT, bold=False, color=DARK_TEXT)),
        ],
        [
            Paragraph(f"<b>Original Bill No:</b> <font color='#1B5E20'><b>{sales_return.invoice_number}</b></font>", styles["Normal"]),
            Paragraph(f"<b>Customer Phone:</b> {sales_return.customer_phone or '-'}", _header_style(9, align=TA_RIGHT, bold=False, color=DARK_TEXT)),
        ],
        [
            Paragraph(f"<b>Customer Name:</b> {sales_return.customer_name or 'Walk-in Farmer'}", styles["Normal"]),
            Paragraph(f"<b>Refund Mode:</b> <b>{pm_str}</b> <font color='#B71C1C'>(REFUNDED)</font>", _header_style(9, align=TA_RIGHT, bold=False, color=DARK_TEXT)),
        ],
    ]
    if sales_return.reason:
        meta_data.append([
            Paragraph(f"<b>Return Reason:</b> {sales_return.reason}", styles["Normal"]),
            Paragraph(f"<b>Stock Status:</b> <font color='#1B5E20'>RESTOCKED TO INVENTORY</font>", _header_style(9, align=TA_RIGHT, bold=False, color=DARK_TEXT)),
        ])

    elements.append(Table(meta_data, colWidths=["55%", "45%"]))
    elements.append(Spacer(1, 6))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey, spaceAfter=4))

    # ── Returned Items Table ─────────────────────────────────
    headers = ["#", "Returned Product", "Net Content", "Qty Ret", "Rate ₹", "GST%", "GST ₹", "Refund ₹"]
    rows = [headers]
    for i, item in enumerate(sales_return.items, 1):
        comp = f"\n<font color='#616161'>{item.company_name}</font>" if item.company_name else ""
        batch = f"\n<font color='#757575'>Batch: {item.batch_number}</font>" if item.batch_number else ""
        rows.append([
            str(i),
            f"{item.product_name}{comp}{batch}",
            item.net_content or "-",
            str(item.returned_quantity),
            f"₹{item.unit_price:,.2f}",
            f"{item.gst_rate}%",
            f"₹{item.refund_gst:,.2f}",
            f"₹{item.refund_total:,.2f}",
        ])

    col_widths = [8 * mm, 58 * mm, 22 * mm, 16 * mm, 22 * mm, 14 * mm, 20 * mm, 20 * mm]
    item_table = Table(rows, colWidths=col_widths, repeatRows=1)
    item_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), LIGHT_RED),
        ("TEXTCOLOR", (0, 0), (-1, 0), RED_ACCENT),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    elements.append(item_table)
    elements.append(Spacer(1, 6))

    # ── Totals & Tax Refund Breakdown ─────────────────────────
    half_gst = (sales_return.refund_gst_amount or Decimal("0")) / Decimal("2")
    totals = [
        ["", "", "", "", "", "", "Taxable Value Returned:", f"₹{sales_return.refund_subtotal:,.2f}"],
        ["", "", "", "", "", "", "CGST Reversal (50%):", f"₹{half_gst:,.2f}"],
        ["", "", "", "", "", "", "SGST Reversal (50%):", f"₹{half_gst:,.2f}"],
        ["", "", "", "", "", "", "Total GST Credit:", f"₹{sales_return.refund_gst_amount:,.2f}"],
        ["", "", "", "", "", "", "TOTAL REFUND PAID:", f"₹{sales_return.refund_grand_total:,.2f}"],
    ]
    totals_table = Table(totals, colWidths=col_widths)
    totals_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("FONTNAME", (6, 4), (7, 4), "Helvetica-Bold"),
        ("FONTSIZE", (6, 4), (7, 4), 9.5),
        ("ALIGN", (6, 0), (7, -1), "RIGHT"),
        ("LINEABOVE", (6, 4), (7, 4), 1, RED_ACCENT),
        ("TEXTCOLOR", (6, 4), (7, 4), RED_ACCENT),
    ]))
    elements.append(totals_table)

    elements.append(Spacer(1, 14))

    # ── Terms & Authorized Signatory ──────────────────────────
    footer_data = [
        [
            Paragraph("<b>Stock Verification & Refund Note:</b><br/>1. Goods received back in verified, seal/usable condition.<br/>2. Physical inventory updated in store godown.<br/>3. Payment refunded as recorded above.", _header_style(7, bold=False, color=colors.dimgrey, align=TA_LEFT)),
            Paragraph(f"For <b>{shop.shop_name or 'NockBill Solutions'}</b><br/><br/><br/><b>Receiver / Authorized Signatory</b>", _header_style(8, bold=False, color=DARK_TEXT, align=TA_RIGHT)),
        ]
    ]
    footer_table = Table(footer_data, colWidths=["60%", "40%"])
    elements.append(footer_table)
    elements.append(Spacer(1, 8))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey))
    elements.append(Paragraph(
        "Credit Note issued under GST provisions. Inventory reconciled successfully.",
        _header_style(8, bold=False, color=colors.grey),
    ))

    doc.build(elements)
    return buf.getvalue()
