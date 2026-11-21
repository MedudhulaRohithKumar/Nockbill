"""
Invoice PDF generation using ReportLab.
Supports both A4 and thermal (80mm wide) layouts.
"""
import base64
from io import BytesIO
from decimal import Decimal
import re
from typing import List
from urllib.parse import quote
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph,
    Spacer, HRFlowable, Image as RLImage
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from reportlab.lib.colors import HexColor
from app.utils.helpers import escape_pdf_text as _esc


GREEN = HexColor("#1B5E20")
LIGHT_GREEN = HexColor("#E8F5E9")
DARK_TEXT = HexColor("#212121")

styles = getSampleStyleSheet()


def _resolve_accent_color(shop) -> HexColor:
    raw = (getattr(shop, "invoice_accent_color", None) or "").strip()
    if re.fullmatch(r"#[0-9a-fA-F]{6}", raw):
        return HexColor(raw)
    return GREEN


def _build_logo_flowable(shop):
    show_logo = getattr(shop, "invoice_show_logo", True)
    logo_val = getattr(shop, "logo_path", None)
    if show_logo is False or not logo_val:
        return None
    try:
        raw_str = str(logo_val).strip()
        if raw_str.startswith("data:image/") and ";base64," in raw_str:
            b64_part = raw_str.split(";base64,", 1)[1]
            img_bytes = base64.b64decode(b64_part)
            return RLImage(BytesIO(img_bytes), width=28 * mm, height=14 * mm, kind="proportional")
    except Exception:
        return None
    return None


def _build_upi_qr_flowable(shop, grand_total: Decimal, inv_num: str):
    if getattr(shop, "invoice_show_bank_details", True) is False:
        return None
    vpa = (getattr(shop, "upi_id", None) or "").strip()
    if not vpa:
        return None
    try:
        sname = (getattr(shop, "shop_name", None) or "NockBill Shop").strip()[:80]
        upi_uri = (
            f"upi://pay?pa={quote(vpa, safe='@._-')}&pn={quote(sname)}"
            f"&am={grand_total:.2f}&tn={quote(inv_num[:40])}&cu=INR"
        )
        qr_widget = QrCodeWidget(upi_uri)
        b = qr_widget.getBounds()
        w = max(b[2] - b[0], 1.0)
        h = max(b[3] - b[1], 1.0)
        size = 24 * mm
        d = Drawing(size, size, transform=[size / w, 0, 0, size / h, 0, 0])
        d.add(qr_widget)
        return d
    except Exception:
        return None


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
    accent_color = _resolve_accent_color(shop)

    # ── Shop Header (with optional logo & tagline) ────────────
    logo_flowable = _build_logo_flowable(shop)
    if logo_flowable is not None:
        logo_flowable.hAlign = "CENTER"
        elements.append(logo_flowable)
        elements.append(Spacer(1, 2))
    elements.append(Paragraph(_esc(shop.shop_name or "NockBill Solutions"), _header_style(18, color=accent_color)))
    tagline = getattr(shop, "invoice_header_tagline", None)
    if tagline:
        elements.append(Paragraph(_esc(tagline), _header_style(8.5, bold=False, color=colors.dimgrey)))
    addr_line = getattr(shop, "address", None) or ", ".join(
        p for p in [getattr(shop, "address_line1", None), getattr(shop, "city", None), getattr(shop, "state", None)] if p
    )
    if addr_line:
        elements.append(Paragraph(_esc(addr_line), _header_style(9, bold=False, color=DARK_TEXT)))
    contact_parts = []
    if shop.phone:
        contact_parts.append(f"Phone: {_esc(shop.phone)}")
    if shop.gstin:
        contact_parts.append(f"GSTIN: {_esc(shop.gstin)}")
    show_licenses = getattr(shop, "invoice_show_licenses", True) is not False
    if show_licenses:
        if getattr(shop, "fertilizer_license_no", None):
            contact_parts.append(f"Fert Lic: {_esc(shop.fertilizer_license_no)}")
        if getattr(shop, "pesticide_license_no", None):
            contact_parts.append(f"Pest Lic: {_esc(shop.pesticide_license_no)}")
        if getattr(shop, "seed_license_no", None):
            contact_parts.append(f"Seed Lic: {_esc(shop.seed_license_no)}")
    if contact_parts:
        elements.append(Paragraph(" | ".join(contact_parts), _header_style(8.5, bold=False, color=DARK_TEXT)))

    elements.append(HRFlowable(width="100%", thickness=1.5, color=accent_color, spaceAfter=4))
    elements.append(Paragraph("<b>TAX INVOICE / RETAIL BILL</b>", _header_style(12, bold=True, color=accent_color)))
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
            Paragraph(f"<b>Bill / Invoice No:</b> <font color='#1B5E20'><b>{_esc(inv_num)}</b></font>", styles["Normal"]),
            Paragraph(f"<b>Date &amp; Time:</b> {_esc(s_date_str)}", _header_style(9, align=TA_RIGHT, bold=False, color=DARK_TEXT)),
        ],
        [
            Paragraph(f"<b>Customer Name:</b> {_esc(sale.customer_name or 'Walk-in Farmer')}", styles["Normal"]),
            Paragraph(f"<b>Phone:</b> {_esc(sale.customer_phone or '-')}", _header_style(9, align=TA_RIGHT, bold=False, color=DARK_TEXT)),
        ],
        [
            Paragraph(f"<b>Payment Mode:</b> {_esc(pm_display)} <font color='#2E7D32'>(PAID)</font>", styles["Normal"]),
            Paragraph(f"<b>Bill Ref ID:</b> #{sale.id:05d}", _header_style(9, align=TA_RIGHT, bold=False, color=DARK_TEXT)),
        ],
    ]

    if getattr(sale, "eway_bill_no", None) or getattr(sale, "vehicle_no", None):
        ewb_part = f"<b>E-Way Bill:</b> <font color='#15803d'>{_esc(sale.eway_bill_no)}</font>" if getattr(sale, "eway_bill_no", None) else ""
        veh_part = f"<b>Vehicle No:</b> {_esc(sale.vehicle_no)}" if getattr(sale, "vehicle_no", None) else ""
        invoice_data.append([
            Paragraph(ewb_part or veh_part, styles["Normal"]),
            Paragraph(veh_part if (ewb_part and veh_part) else "", _header_style(9, align=TA_RIGHT, bold=False, color=DARK_TEXT)),
        ])

    elements.append(Table(invoice_data, colWidths=["55%", "45%"]))
    elements.append(Spacer(1, 6))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey, spaceAfter=4))

    # ── Line Items ───────────────────────────────────────────
    headers = ["#", "Product Description", "Net Content", "Qty", "Price ₹", "GST%", "GST ₹", "Total ₹"]
    rows = [headers]
    computed_subtotal = Decimal("0")
    computed_gst = Decimal("0")
    computed_grand_total = Decimal("0")

    for i, item in enumerate(sale.items, 1):
        comp = f"\n{item.company_name}" if item.company_name else ""
        qty = Decimal(str(item.quantity or 0))
        unit_p = Decimal(str(item.price or 0))
        gst_r = Decimal(str(item.gst_rate or 0))

        # Selling price is tax-inclusive. Ensure line total does not add GST on top.
        nominal_gross = (qty * unit_p).quantize(Decimal("0.01"))
        raw_total = Decimal(str(item.total or 0)).quantize(Decimal("0.01")) if item.total else nominal_gross
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
            f"{item.product_name}{comp}",
            item.net_content or "-",
            str(item.quantity),
            f"₹{unit_p:,.2f}",
            f"{gst_r}%",
            f"₹{line_gst:,.2f}",
            f"₹{line_total:,.2f}",
        ])

    item_table = Table(
        rows,
        colWidths=[8 * mm, 55 * mm, 25 * mm, 12 * mm, 22 * mm, 15 * mm, 22 * mm, 22 * mm],
        repeatRows=1,
    )
    item_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), accent_color),
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
    elements.append(Spacer(1, 3))
    elements.append(Paragraph(
        "<font size='7' color='#555555'><i>* All product prices are inclusive of GST. GST amount indicates the statutory tax component included in the price.</i></font>",
        styles["Normal"]
    ))
    elements.append(Spacer(1, 4))

    # ── Totals & Tax Split ────────────────────────────────────
    effective_subtotal = computed_subtotal if computed_subtotal > Decimal("0") else (sale.subtotal or Decimal("0"))
    effective_gst = computed_gst if computed_gst > Decimal("0") else (sale.gst_amount or Decimal("0"))
    effective_grand_total = computed_grand_total if computed_grand_total > Decimal("0") else (sale.grand_total or Decimal("0"))

    cgst = (effective_gst / Decimal("2")).quantize(Decimal("0.01"))
    sgst = effective_gst - cgst

    totals = [
        ["", "", "", "", "", "", "Taxable Amount:", f"₹{effective_subtotal:,.2f}"],
        ["", "", "", "", "", "", "CGST (50%):", f"₹{cgst:,.2f}"],
        ["", "", "", "", "", "", "SGST (50%):", f"₹{sgst:,.2f}"],
        ["", "", "", "", "", "", "Total GST:", f"₹{effective_gst:,.2f}"],
        ["", "", "", "", "", "", "GRAND TOTAL:", f"₹{effective_grand_total:,.2f}"],
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
        ("LINEABOVE", (6, 4), (7, 4), 1, accent_color),
        ("TEXTCOLOR", (6, 4), (7, 4), accent_color),
    ]))
    elements.append(totals_table)

    elements.append(Spacer(1, 14))

    # ── Terms, Bank Details & Authorized Signatory ────────────
    raw_terms = getattr(shop, "terms_conditions", None)
    if raw_terms:
        terms_html = "<br/>".join(_esc(line) for line in str(raw_terms).splitlines() if line.strip())
    else:
        terms_html = "1. Certified quality products.<br/>2. Goods once sold will not be returned without bill.<br/>3. Subject to local jurisdiction."

    bank_html = ""
    if getattr(shop, "invoice_show_bank_details", True) is not False and getattr(shop, "bank_account_no", None):
        bank_parts = [
            f"Bank: {_esc(shop.bank_name or '-')}",
            f"A/C: {_esc(shop.bank_account_no)}",
        ]
        if getattr(shop, "bank_ifsc", None):
            bank_parts.append(f"IFSC: {_esc(shop.bank_ifsc)}")
        if getattr(shop, "upi_id", None):
            bank_parts.append(f"UPI: {_esc(shop.upi_id)}")
        bank_html = f"<br/><br/><b>Bank / UPI Details:</b><br/>{' | '.join(bank_parts)}"

    sig_label = _esc(getattr(shop, "invoice_signature_label", None) or "Authorized Signatory")
    footer_note = _esc(
        getattr(shop, "invoice_footer_note", None)
        or "Thank you for shopping with us! Wishing you a prosperous harvest."
    )

    qr_flowable = _build_upi_qr_flowable(shop, effective_grand_total, inv_num)
    if qr_flowable is not None:
        footer_data = [
            [
                Paragraph(f"<b>Terms &amp; Conditions:</b><br/>{terms_html}{bank_html}", _header_style(7, bold=False, color=colors.dimgrey, align=TA_LEFT)),
                qr_flowable,
                Paragraph(f"For <b>{_esc(shop.shop_name or 'NockBill Solutions')}</b><br/><br/><br/><b>{sig_label}</b>", _header_style(8, bold=False, color=DARK_TEXT, align=TA_RIGHT)),
            ]
        ]
        footer_table = Table(footer_data, colWidths=["52%", "18%", "30%"])
    else:
        footer_data = [
            [
                Paragraph(f"<b>Terms &amp; Conditions:</b><br/>{terms_html}{bank_html}", _header_style(7, bold=False, color=colors.dimgrey, align=TA_LEFT)),
                Paragraph(f"For <b>{_esc(shop.shop_name or 'NockBill Solutions')}</b><br/><br/><br/><b>{sig_label}</b>", _header_style(8, bold=False, color=DARK_TEXT, align=TA_RIGHT)),
            ]
        ]
        footer_table = Table(footer_data, colWidths=["60%", "40%"])
    elements.append(footer_table)
    elements.append(Spacer(1, 8))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey))
    elements.append(Paragraph(
        footer_note,
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
    elements.append(Paragraph(_esc(shop.shop_name or "Fertilizer Shop"), _header_style(18)))
    if shop.address:
        elements.append(Paragraph(_esc(shop.address), _header_style(9, bold=False, color=DARK_TEXT)))
    if shop.phone:
        elements.append(Paragraph(f"Phone: {_esc(shop.phone)}", _header_style(9, bold=False, color=DARK_TEXT)))
    if shop.gstin:
        elements.append(Paragraph(f"GSTIN: {_esc(shop.gstin)}", _header_style(9, bold=False, color=DARK_TEXT)))

    elements.append(HRFlowable(width="100%", thickness=1, color=HexColor("#1565C0"), spaceAfter=4))
    elements.append(Paragraph("<b>GOODS INWARD &amp; PURCHASE RECEIPT</b>", _header_style(12, bold=True, color=HexColor("#1565C0"))))
    elements.append(Spacer(1, 4))

    # ── Bill Details ──────────────────────────────────────────
    p_date = purchase.purchase_date.strftime('%d/%m/%Y %I:%M %p') if purchase.purchase_date else "-"
    inv_num = purchase.invoice_number or f"PO-{purchase.id}"
    supp_name = purchase.supplier_name or "Direct Supplier / Depot"

    purchase_data = [
        [
            Paragraph(f"<b>Inward / Bill No:</b> {_esc(inv_num)}", styles["Normal"]),
            Paragraph(f"<b>Date:</b> {_esc(p_date)}", _header_style(9, align=TA_RIGHT)),
        ],
        [
            Paragraph(f"<b>Supplier:</b> {_esc(supp_name)}", styles["Normal"]),
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
        elements.append(Paragraph(f"<b>Notes:</b> {_esc(purchase.notes)}", styles["Normal"]))

    elements.append(Spacer(1, 14))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey))
    elements.append(Paragraph(
        f"Stock verified and entered into {_esc(shop.shop_name or 'NockBill Solutions')} inventory.",
        _header_style(9, bold=False, color=colors.grey),
    ))

    doc.build(elements)
    return buf.getvalue()

