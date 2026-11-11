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
    computed_subtotal = Decimal("0")
    computed_gst = Decimal("0")
    computed_grand_total = Decimal("0")

    for i, item in enumerate(sales_return.items, 1):
        comp = f"\n<font color='#616161'>{item.company_name}</font>" if item.company_name else ""
        batch = f"\n<font color='#757575'>Batch: {item.batch_number}</font>" if item.batch_number else ""
        qty = Decimal(str(item.returned_quantity or 0))
        unit_p = Decimal(str(item.unit_price or 0))
        gst_r = Decimal(str(item.gst_rate or 0))

        nominal_gross = (qty * unit_p).quantize(Decimal("0.01"))
        raw_total = Decimal(str(item.refund_total or 0)).quantize(Decimal("0.01")) if item.refund_total else nominal_gross
        line_total = min(raw_total, nominal_gross) if raw_total > nominal_gross else raw_total

        if gst_r > Decimal("0"):
            divisor = Decimal("1") + (gst_r / Decimal("100"))
            line_taxable = (line_total / divisor).quantize(Decimal("0.01"))
            line_gst = line_total - line_taxable
        else:
            line_taxable = line_total
            line_gst = Decimal("0.00")

        computed_subtotal += line_taxable
        computed_gst += line_gst
        computed_grand_total += line_total

        rows.append([
            str(i),
            f"{item.product_name}{comp}{batch}",
            item.net_content or "-",
            str(item.returned_quantity),
            f"₹{unit_p:,.2f}",
            f"{gst_r}%",
            f"₹{line_gst:,.2f}",
            f"₹{line_total:,.2f}",
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
    elements.append(Spacer(1, 3))
    elements.append(Paragraph(
        "<font size='7' color='#555555'><i>* Return refund values are calculated on tax-inclusive unit prices.</i></font>",
        styles["Normal"]
    ))
    elements.append(Spacer(1, 4))

    # ── Totals & Tax Refund Breakdown ─────────────────────────
    effective_subtotal = computed_subtotal if computed_subtotal > Decimal("0") else (sales_return.refund_subtotal or Decimal("0"))
    effective_gst = computed_gst if computed_gst > Decimal("0") else (sales_return.refund_gst_amount or Decimal("0"))
    effective_grand_total = computed_grand_total if computed_grand_total > Decimal("0") else (sales_return.refund_grand_total or Decimal("0"))

    cgst = (effective_gst / Decimal("2")).quantize(Decimal("0.01"))
    sgst = effective_gst - cgst

    totals = [
        ["", "", "", "", "", "", "Taxable Value Returned:", f"₹{effective_subtotal:,.2f}"],
        ["", "", "", "", "", "", "CGST Reversal (50%):", f"₹{cgst:,.2f}"],
        ["", "", "", "", "", "", "SGST Reversal (50%):", f"₹{sgst:,.2f}"],
        ["", "", "", "", "", "", "Total GST Credit:", f"₹{effective_gst:,.2f}"],
        ["", "", "", "", "", "", "TOTAL REFUND PAID:", f"₹{effective_grand_total:,.2f}"],
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
