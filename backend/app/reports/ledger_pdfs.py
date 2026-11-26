"""
Statutory & Financial PDF Document Generators using ReportLab.
Produces clean, standalone printable PDFs (zero web UI chrome) for:
- Financial & GST Tax Reports (Sales, Purchases, GSTR-1, Stock Valuation, Profit & Loss)
- Statutory Compliance & Khata Registers (Form O, Form M, APMC Price Board, Farmer & Supplier Ledgers)
- 80mm Direct Thermal POS Invoices, 80mm Hardware Calibration Test Slips, and Merchant UPI QR Standees
"""
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from io import BytesIO
from typing import Iterable, List, Optional, Sequence, Tuple
from urllib.parse import quote

from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4, A5
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.utils.helpers import escape_pdf_text as _esc

_FONT_BOLD = "Helvetica-Bold"
_FONT_REGULAR = "Helvetica"
_FONT_MONO = "Courier"
_FONT_MONO_BOLD = "Courier-Bold"
_BRAND_GREEN = HexColor("#14532D")
_BRAND_ACCENT = HexColor("#15803D")
_ROW_ALT = HexColor("#F0FDF4")
_DARK_INK = HexColor("#0F172A")
_MUTED_INK = HexColor("#475569")
_BORDER_GREY = HexColor("#CBD5E1")
_IST = timezone(timedelta(hours=5, minutes=30))
_DEFAULT_SHOP_NAME = "NockBill Agro Kendra"
_CMD_TOP_PAD = "TOPPADDING"
_CMD_BOT_PAD = "BOTTOMPADDING"
_CMD_LEFT_PAD = "LEFTPADDING"
_CMD_RIGHT_PAD = "RIGHTPADDING"

_BASE_STYLES = getSampleStyleSheet()


def _pstyle(
    name: str,
    size: float = 9,
    *,
    bold: bool = False,
    mono: bool = False,
    color=None,
    align: int = TA_LEFT,
    leading: Optional[float] = None,
    space_after: float = 2,
) -> ParagraphStyle:
    if mono:
        font_name = _FONT_MONO_BOLD if bold else _FONT_MONO
    else:
        font_name = _FONT_BOLD if bold else _FONT_REGULAR
    return ParagraphStyle(
        name,
        parent=_BASE_STYLES["Normal"],
        fontName=font_name,
        fontSize=size,
        leading=leading or (size + 2.5),
        textColor=color or _DARK_INK,
        alignment=align,
        spaceAfter=space_after,
    )


def _now_ist_label() -> str:
    return datetime.now(_IST).strftime("%d %b %Y, %I:%M %p IST")


def _append_shop_letterhead(elements: list, shop, document_title: str, subtitle: Optional[str] = None) -> None:
    shop_name = getattr(shop, "shop_name", None) or _DEFAULT_SHOP_NAME
    elements.append(
        Paragraph(_esc(shop_name), _pstyle("LhShop", 16, bold=True, color=_BRAND_GREEN, align=TA_CENTER))
    )

    addr = getattr(shop, "address", None) or ", ".join(
        p
        for p in [
            getattr(shop, "address_line1", None),
            getattr(shop, "city", None),
            getattr(shop, "state", None),
            getattr(shop, "pincode", None),
        ]
        if p
    )
    if addr:
        elements.append(Paragraph(_esc(addr), _pstyle("LhAddr", 8.5, color=_MUTED_INK, align=TA_CENTER)))

    reg_parts: List[str] = []
    if getattr(shop, "gstin", None):
        reg_parts.append(f"GSTIN: {_esc(shop.gstin)}")
    if getattr(shop, "phone", None):
        reg_parts.append(f"Mobile: {_esc(shop.phone)}")
    if getattr(shop, "fertilizer_license_no", None):
        reg_parts.append(f"FCO Lic: {_esc(shop.fertilizer_license_no)}")
    if getattr(shop, "pesticide_license_no", None):
        reg_parts.append(f"CIB Lic: {_esc(shop.pesticide_license_no)}")
    if getattr(shop, "seed_license_no", None):
        reg_parts.append(f"Seed Lic: {_esc(shop.seed_license_no)}")
    if reg_parts:
        elements.append(
            Paragraph(" &bull; ".join(reg_parts), _pstyle("LhRegs", 8, color=_DARK_INK, align=TA_CENTER))
        )

    elements.append(Spacer(1, 2 * mm))
    elements.append(HRFlowable(width="100%", thickness=1.4, color=_BRAND_ACCENT, spaceAfter=3 * mm))
    elements.append(
        Paragraph(_esc(document_title), _pstyle("DocTitle", 12, bold=True, color=_BRAND_GREEN, align=TA_CENTER))
    )
    if subtitle:
        elements.append(
            Paragraph(_esc(subtitle), _pstyle("DocSub", 8.5, color=_MUTED_INK, align=TA_CENTER, space_after=4))
        )
    elements.append(Spacer(1, 2 * mm))


def generate_structured_table_pdf(
    *,
    shop: object,
    document_title: str,
    subtitle: Optional[str] = None,
    summary_metrics: Optional[Sequence[Tuple[str, str]]] = None,
    headers: Sequence[str],
    rows: Iterable[Sequence[str]],
    col_widths_mm: Optional[Sequence[float]] = None,
    right_align_cols: Optional[Sequence[int]] = None,
    footer_notice: Optional[str] = None,
) -> bytes:
    """Render an official A4 portrait tabular report PDF with KPI summary strip and signatory block."""
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=10 * mm,
        rightMargin=10 * mm,
        topMargin=10 * mm,
        bottomMargin=12 * mm,
    )
    elements: list = []
    _append_shop_letterhead(
        elements,
        shop,
        document_title,
        subtitle=subtitle or f"Generated on {_now_ist_label()}",
    )

    if summary_metrics:
        metric_cells = [
            Paragraph(
                f"<font size='7' color='#475569'><b>{_esc(label.upper())}</b></font><br/>"
                f"<font size='10' color='#0F172A'><b>{_esc(val)}</b></font>",
                _pstyle(f"Metric_{idx}", 9, align=TA_CENTER),
            )
            for idx, (label, val) in enumerate(summary_metrics[:4])
        ]
        if metric_cells:
            usable_w = 190 * mm
            cell_w = usable_w / len(metric_cells)
            kpi_table = Table([metric_cells], colWidths=[cell_w] * len(metric_cells))
            kpi_table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, -1), _ROW_ALT),
                        ("BOX", (0, 0), (-1, -1), 0.6, _BORDER_GREY),
                        ("INNERGRID", (0, 0), (-1, -1), 0.4, _BORDER_GREY),
                        (_CMD_TOP_PAD, (0, 0), (-1, -1), 5),
                        (_CMD_BOT_PAD, (0, 0), (-1, -1), 5),
                    ]
                )
            )
            elements.append(kpi_table)
            elements.append(Spacer(1, 4 * mm))

    cell_style_left = _pstyle("CellL", 7.8, leading=9.5)
    cell_style_right = _pstyle("CellR", 7.8, leading=9.5, align=TA_RIGHT)
    head_style_left = _pstyle("HeadL", 8, bold=True, color=colors.white)
    head_style_right = _pstyle("HeadR", 8, bold=True, color=colors.white, align=TA_RIGHT)
    right_cols = set(right_align_cols or [])

    table_data: List[List[Paragraph]] = [
        [
            Paragraph(_esc(h), head_style_right if c_idx in right_cols else head_style_left)
            for c_idx, h in enumerate(headers)
        ]
    ]

    materialized_rows = list(rows)
    if not materialized_rows:
        empty_row = ["No records found for the selected filter / period."] + [""] * max(0, len(headers) - 1)
        table_data.append([Paragraph(_esc(cell), cell_style_left) for cell in empty_row])
    else:
        for r in materialized_rows:
            table_data.append(
                [
                    Paragraph(_esc(str(cell)), cell_style_right if c_idx in right_cols else cell_style_left)
                    for c_idx, cell in enumerate(r)
                ]
            )

    if col_widths_mm and len(col_widths_mm) == len(headers):
        widths = [w * mm for w in col_widths_mm]
    else:
        widths = [(190.0 / max(1, len(headers))) * mm] * len(headers)

    data_table = Table(table_data, colWidths=widths, repeatRows=1)
    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), _BRAND_GREEN),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, _ROW_ALT]),
        ("GRID", (0, 0), (-1, -1), 0.35, _BORDER_GREY),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        (_CMD_TOP_PAD, (0, 0), (-1, -1), 4),
        (_CMD_BOT_PAD, (0, 0), (-1, -1), 4),
        (_CMD_LEFT_PAD, (0, 0), (-1, -1), 4),
        (_CMD_RIGHT_PAD, (0, 0), (-1, -1), 4),
    ]
    data_table.setStyle(TableStyle(style_cmds))
    elements.append(data_table)

    elements.append(Spacer(1, 6 * mm))
    notice_text = (
        footer_notice
        or "Certified computer-generated statutory extract from NockBill Agro ERP. All retail rates are inclusive of applicable category GST."
    )
    sig_label = getattr(shop, "invoice_signature_label", None) or "Authorized Signatory"
    shop_name = getattr(shop, "shop_name", None) or _DEFAULT_SHOP_NAME
    footer_tbl = Table(
        [
            [
                Paragraph(_esc(notice_text), _pstyle("FootNote", 7.5, color=_MUTED_INK)),
                Paragraph(
                    f"For <b>{_esc(shop_name)}</b><br/><br/><b>{_esc(sig_label)}</b>",
                    _pstyle("FootSig", 8, align=TA_RIGHT),
                ),
            ]
        ],
        colWidths=[125 * mm, 65 * mm],
    )
    elements.append(footer_tbl)
    doc.build(elements)
    return buf.getvalue()


def generate_thermal_invoice_pdf(sale, shop) -> bytes:
    """Generate an exact 80mm-wide ESC/POS thermal receipt PDF (single continuous roll page)."""
    items = list(getattr(sale, "items", None) or [])
    est_height_mm = max(135, 95 + len(items) * 14)
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=(80 * mm, est_height_mm * mm),
        leftMargin=4 * mm,
        rightMargin=4 * mm,
        topMargin=4 * mm,
        bottomMargin=4 * mm,
    )
    elements: list = []
    shop_name = getattr(shop, "shop_name", None) or _DEFAULT_SHOP_NAME
    elements.append(Paragraph(_esc(shop_name.upper()), _pstyle("ThShop", 10, bold=True, mono=True, align=TA_CENTER)))
    if getattr(shop, "gstin", None):
        elements.append(Paragraph(f"GSTIN: {_esc(shop.gstin)}", _pstyle("ThGst", 7.5, mono=True, align=TA_CENTER)))
    if getattr(shop, "phone", None):
        elements.append(Paragraph(f"Ph: {_esc(shop.phone)}", _pstyle("ThPh", 7.5, mono=True, align=TA_CENTER)))

    elements.append(HRFlowable(width="100%", thickness=0.6, color=_DARK_INK, spaceBefore=2, spaceAfter=3))
    inv_no = getattr(sale, "invoice_number", None) or f"INV-{sale.id}"
    dt_str = sale.sale_date.strftime("%d/%m/%Y %H:%M") if getattr(sale, "sale_date", None) else "-"
    cust = getattr(sale, "customer_name", None) or "Walk-in Farmer"
    pm = sale.payment_method.value if hasattr(sale.payment_method, "value") else str(sale.payment_method or "CASH")

    elements.append(Paragraph(f"BILL: {_esc(inv_no)}", _pstyle("ThMeta1", 8, bold=True, mono=True)))
    elements.append(Paragraph(f"DATE: {_esc(dt_str)} | {_esc(pm)}", _pstyle("ThMeta2", 7.5, mono=True)))
    elements.append(Paragraph(f"FARMER: {_esc(cust)}", _pstyle("ThMeta3", 7.5, mono=True)))
    elements.append(HRFlowable(width="100%", thickness=0.6, color=_DARK_INK, spaceBefore=2, spaceAfter=3))

    rows = [
        [
            Paragraph("ITEM", _pstyle("ThH1", 7.5, bold=True, mono=True)),
            Paragraph("QTY", _pstyle("ThH2", 7.5, bold=True, mono=True, align=TA_RIGHT)),
            Paragraph("AMT", _pstyle("ThH3", 7.5, bold=True, mono=True, align=TA_RIGHT)),
        ]
    ]
    grand = Decimal("0.00")
    for it in items:
        qty = Decimal(str(it.quantity or 0))
        unit_p = Decimal(str(it.price or 0))
        line_tot = Decimal(str(it.total or (qty * unit_p))).quantize(Decimal("0.01"))
        grand += line_tot
        rows.append(
            [
                Paragraph(_esc(str(it.product_name or "Item")[:26]), _pstyle("ThC1", 7.2, mono=True)),
                Paragraph(_esc(f"{qty:g}"), _pstyle("ThC2", 7.2, mono=True, align=TA_RIGHT)),
                Paragraph(_esc(f"{line_tot:,.2f}"), _pstyle("ThC3", 7.2, mono=True, align=TA_RIGHT)),
            ]
        )

    tbl = Table(rows, colWidths=[38 * mm, 12 * mm, 22 * mm])
    tbl.setStyle(
        TableStyle(
            [
                ("LINEBELOW", (0, 0), (-1, 0), 0.5, _DARK_INK),
                (_CMD_TOP_PAD, (0, 0), (-1, -1), 2),
                (_CMD_BOT_PAD, (0, 0), (-1, -1), 2),
                (_CMD_LEFT_PAD, (0, 0), (-1, -1), 0),
                (_CMD_RIGHT_PAD, (0, 0), (-1, -1), 0),
            ]
        )
    )
    elements.append(tbl)
    elements.append(HRFlowable(width="100%", thickness=0.8, color=_DARK_INK, spaceBefore=3, spaceAfter=3))

    final_total = Decimal(str(getattr(sale, "grand_total", None) or grand)).quantize(Decimal("0.01"))
    elements.append(
        Paragraph(f"NET PAYABLE: Rs.{final_total:,.2f}", _pstyle("ThTot", 9.5, bold=True, mono=True, align=TA_RIGHT))
    )
    elements.append(
        Paragraph("(Inclusive of Category GST)", _pstyle("ThSub", 6.8, mono=True, color=_MUTED_INK, align=TA_RIGHT))
    )
    elements.append(Spacer(1, 3 * mm))
    elements.append(Paragraph("Thank you! Visit Again.", _pstyle("ThFoot", 7.5, bold=True, mono=True, align=TA_CENTER)))
    doc.build(elements)
    return buf.getvalue()


def generate_thermal_test_slip_pdf(shop, printer_port: str = "USB001 (80mm Direct Thermal)") -> bytes:
    """Generate an 80mm ESC/POS hardware calibration test slip PDF."""
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=(80 * mm, 95 * mm),
        leftMargin=4 * mm,
        rightMargin=4 * mm,
        topMargin=4 * mm,
        bottomMargin=4 * mm,
    )
    shop_name = getattr(shop, "shop_name", None) or _DEFAULT_SHOP_NAME
    gstin = getattr(shop, "gstin", None) or "UNREGISTERED"
    elements = [
        Paragraph(f"*** {_esc(shop_name.upper())} ***", _pstyle("Ts1", 9.5, bold=True, mono=True, align=TA_CENTER)),
        Paragraph(f"GSTIN: {_esc(gstin)}", _pstyle("Ts2", 7.5, mono=True, align=TA_CENTER)),
        Paragraph("80mm Direct Thermal POS Engine", _pstyle("Ts3", 7.5, mono=True, align=TA_CENTER)),
        HRFlowable(width="100%", thickness=0.6, color=_DARK_INK, spaceBefore=3, spaceAfter=3),
        Paragraph("TEST PRINT: ESC/POS ENGINE OK", _pstyle("Ts4", 8, bold=True, mono=True)),
        Paragraph(f"PORT: {_esc(printer_port)}", _pstyle("Ts5", 7.5, mono=True)),
        Paragraph(f"TIME: {_esc(_now_ist_label())}", _pstyle("Ts6", 7.5, mono=True)),
        Paragraph("AUTO-CUTTER: VERIFIED (PARTIAL)", _pstyle("Ts7", 7.5, mono=True)),
        HRFlowable(width="100%", thickness=0.6, color=_DARK_INK, spaceBefore=3, spaceAfter=3),
        Paragraph("READY FOR COUNTER BILLING", _pstyle("Ts8", 8, bold=True, mono=True, align=TA_CENTER)),
    ]
    doc.build(elements)
    return buf.getvalue()


def generate_upi_standee_pdf(shop) -> bytes:
    """Generate a counter-top A5 Merchant UPI QR Standee PDF."""
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A5,
        leftMargin=12 * mm,
        rightMargin=12 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
    )
    shop_name = getattr(shop, "shop_name", None) or _DEFAULT_SHOP_NAME
    vpa = (getattr(shop, "upi_id", None) or "merchant@upi").strip()
    upi_uri = f"upi://pay?pa={quote(vpa, safe='@._-')}&pn={quote(shop_name[:80])}&cu=INR"

    qr_widget = QrCodeWidget(upi_uri)
    bounds = qr_widget.getBounds()
    w = max(bounds[2] - bounds[0], 1.0)
    h = max(bounds[3] - bounds[1], 1.0)
    qr_size = 68 * mm
    qr_drawing = Drawing(qr_size, qr_size, transform=[qr_size / w, 0, 0, qr_size / h, 0, 0])
    qr_drawing.hAlign = "CENTER"
    qr_drawing.add(qr_widget)

    elements = [
        Paragraph(_esc(shop_name), _pstyle("StShop", 18, bold=True, color=_BRAND_GREEN, align=TA_CENTER, space_after=4)),
        Paragraph("SCAN &amp; PAY VIA ANY UPI APP", _pstyle("StSub", 11, bold=True, color=_BRAND_ACCENT, align=TA_CENTER)),
        Paragraph("GPay &bull; PhonePe &bull; Paytm &bull; BHIM UPI", _pstyle("StApps", 9, color=_MUTED_INK, align=TA_CENTER)),
        Spacer(1, 8 * mm),
        qr_drawing,
        Spacer(1, 6 * mm),
        Paragraph(f"UPI ID: <b>{_esc(vpa)}</b>", _pstyle("StVpa", 11, mono=True, align=TA_CENTER)),
    ]
    if getattr(shop, "gstin", None):
        elements.append(Spacer(1, 3 * mm))
        elements.append(
            Paragraph(f"GSTIN: {_esc(shop.gstin)}", _pstyle("StGst", 8.5, color=_MUTED_INK, align=TA_CENTER))
        )
    doc.build(elements)
    return buf.getvalue()
