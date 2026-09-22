"""
Excel (xlsx) export utilities.
"""
import io
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter


GREEN_FILL = PatternFill(start_color="1B5E20", end_color="1B5E20", fill_type="solid")
LIGHT_GREEN_FILL = PatternFill(start_color="E8F5E9", end_color="E8F5E9", fill_type="solid")
WHITE_FONT = Font(color="FFFFFF", bold=True)
HEADER_FONT = Font(bold=True)
THIN_BORDER = Border(
    left=Side(style="thin"),
    right=Side(style="thin"),
    top=Side(style="thin"),
    bottom=Side(style="thin"),
)


def _apply_header(ws, row, headers):
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=row, column=col, value=header)
        cell.font = WHITE_FONT
        cell.fill = GREEN_FILL
        cell.alignment = Alignment(horizontal="center")
        cell.border = THIN_BORDER


def export_gst_report_excel(rows, summary, period: str) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = f"GST Report"
    ws.append([f"GST Report - {period}"])
    ws["A1"].font = Font(bold=True, size=14)
    ws.append([])

    # Summary
    ws.append(["Total Sales", f"₹{summary.total_sales}"])
    ws.append(["Total GST", f"₹{summary.total_gst}"])
    ws.append(["5% GST", f"₹{summary.gst_5_amount}"])
    ws.append(["18% GST", f"₹{summary.gst_18_amount}"])
    ws.append([])

    headers = ["Date", "Invoice No", "Taxable Amount", "GST Rate", "GST Amount", "Total"]
    _apply_header(ws, ws.max_row + 1, headers)
    for row in rows:
        ws.append([
            row.transaction_date.strftime("%d/%m/%Y"),
            row.invoice_number,
            float(row.taxable_amount),
            f"{row.gst_rate}%",
            float(row.gst_amount),
            float(row.total),
        ])

    # Auto-width
    for col in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        ws.column_dimensions[get_column_letter(col[0].column)].width = min(max_len + 4, 30)

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def export_stock_report_excel(rows) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Stock Report"
    headers = [
        "Product", "Company", "Net Content",
        "Opening Stock", "Purchased", "Sold", "Returned", "Damaged",
        "Current Stock", "Min Stock", "Stock Value (₹)",
    ]
    _apply_header(ws, 1, headers)
    for row in rows:
        ws.append([
            row.product_name,
            row.company_name or "-",
            row.net_content or "-",
            float(row.opening_stock),
            float(row.purchased),
            float(row.sold),
            float(row.returned),
            float(row.damaged),
            float(row.current_stock),
            float(row.minimum_stock),
            float(row.stock_value),
        ])

    for col in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        ws.column_dimensions[get_column_letter(col[0].column)].width = min(max_len + 4, 30)

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
