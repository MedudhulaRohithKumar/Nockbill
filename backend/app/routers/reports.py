from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

import io

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import extract, func, text
from sqlalchemy.orm import Session

from app.database.base import get_db
from app.models.models import (
    Expense,
    GstTransaction,
    Product,
    Purchase,
    Sale,
    SaleItem,
    SalesReturn,
    SalesReturnItem,
    ShopSettings,
    User,
)
from app.reports.ledger_pdfs import generate_structured_table_pdf
from app.schemas.schemas import GstReportRow, GstReportSummary
from app.utils.auth import get_current_user
from app.utils.helpers import sanitize_download_filename

router = APIRouter(prefix="/api/reports", tags=["Reports"])

_IST = timezone(timedelta(hours=5, minutes=30))
_DEFAULT_CATEGORY_PRODUCTS_LIMIT = 50

_STANDARD_GST_SLABS: Tuple[Decimal, ...] = (
    Decimal("0"),
    Decimal("5"),
    Decimal("12"),
    Decimal("18"),
    Decimal("28"),
)

_STANDARD_CATEGORIES: Tuple[str, ...] = (
    "Fertilizer",
    "Pesticide",
    "Seeds",
    "Micronutrients",
    "Bio-Fertilizer",
    "Microgreens",
    "Organic",
    "Others",
)


def _ist_start_to_utc_naive(d: date) -> datetime:
    """Convert IST calendar day start (00:00:00+05:30) to UTC-naive datetime for DB filtering (SD7)."""
    return datetime(d.year, d.month, d.day, 0, 0, 0, tzinfo=_IST).astimezone(timezone.utc).replace(tzinfo=None)


def _ist_end_to_utc_naive(d: date) -> datetime:
    """Convert IST calendar day end (23:59:59.999999+05:30) to UTC-naive datetime for DB filtering (SD7)."""
    return datetime(d.year, d.month, d.day, 23, 59, 59, 999999, tzinfo=_IST).astimezone(timezone.utc).replace(tzinfo=None)


def _ist_month_bounds_utc_naive(year: int, month: int) -> Tuple[datetime, datetime]:
    """Convert an IST calendar month into an index-friendly UTC-naive [start, end] range (SD7)."""
    first_day = date(year, month, 1)
    next_month_first = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
    last_day = next_month_first - timedelta(days=1)
    return _ist_start_to_utc_naive(first_day), _ist_end_to_utc_naive(last_day)


def _effective_cost_expr():
    """Prefer immutable SaleItem.cost_price snapshot; fall back to Product.purchase_price for legacy rows (B6)."""
    return func.coalesce(SaleItem.cost_price, Product.purchase_price, Decimal("0"))


def _effective_return_cost_expr():
    """Prefer immutable SalesReturnItem.cost_price snapshot; fall back to Product.purchase_price (SD2)."""
    return func.coalesce(SalesReturnItem.cost_price, Product.purchase_price, Decimal("0"))


def _sql_day_expr(db: Session, column):
    """Bucket UTC timestamps by IST (+05:30) calendar day (SD7)."""
    dialect = db.bind.dialect.name if db.bind is not None else "sqlite"
    if dialect == "postgresql":
        return func.to_char(column + text("INTERVAL '330 minutes'"), "YYYY-MM-DD")
    return func.strftime("%Y-%m-%d", column, "+5 hours", "+30 minutes")


def _sql_hour_expr(db: Session, column):
    """Bucket UTC timestamps by IST (+05:30) hour of day (SD7)."""
    dialect = db.bind.dialect.name if db.bind is not None else "sqlite"
    if dialect == "postgresql":
        return extract("hour", column + text("INTERVAL '330 minutes'"))
    return func.cast(func.strftime("%H", column, "+5 hours", "+30 minutes"), Sale.id.type)


def _resolve_date_window(
    preset: Optional[str],
    start_date: Optional[str],
    end_date: Optional[str],
) -> Tuple[datetime, datetime]:
    """Resolve preset or explicit date strings into UTC-naive bounds aligned to IST business days (SD7)."""
    now_ist = datetime.now(_IST)
    today_ist = now_ist.date()
    now_utc_naive = now_ist.astimezone(timezone.utc).replace(tzinfo=None)
    dt_start: Optional[datetime] = None
    dt_end: Optional[datetime] = None

    if preset == "today":
        dt_start = _ist_start_to_utc_naive(today_ist)
        dt_end = _ist_end_to_utc_naive(today_ist)
    elif preset == "yesterday":
        yest = today_ist - timedelta(days=1)
        dt_start = _ist_start_to_utc_naive(yest)
        dt_end = _ist_end_to_utc_naive(yest)
    elif preset == "last_7_days":
        dt_start = _ist_start_to_utc_naive(today_ist - timedelta(days=7))
        dt_end = now_utc_naive
    elif preset == "this_month":
        dt_start = _ist_start_to_utc_naive(date(today_ist.year, today_ist.month, 1))
        dt_end = now_utc_naive
    elif preset == "last_month":
        first_this = date(today_ist.year, today_ist.month, 1)
        last_month_end_day = first_this - timedelta(days=1)
        dt_start = _ist_start_to_utc_naive(date(last_month_end_day.year, last_month_end_day.month, 1))
        dt_end = _ist_end_to_utc_naive(last_month_end_day)
    elif preset == "all":
        # Cap open-ended preset at 3 years to keep analytics responsive at scale (B5)
        dt_start = _ist_start_to_utc_naive(date(max(2020, today_ist.year - 3), 1, 1))
        dt_end = now_utc_naive

    if start_date:
        try:
            if "T" in start_date or " " in start_date:
                parsed = datetime.fromisoformat(start_date.replace("Z", "+00:00").replace(" ", "T"))
                dt_start = parsed.astimezone(timezone.utc).replace(tzinfo=None) if parsed.tzinfo else parsed
            else:
                dt_start = _ist_start_to_utc_naive(date.fromisoformat(start_date))
        except Exception:
            pass

    if end_date:
        try:
            if "T" in end_date or " " in end_date:
                parsed = datetime.fromisoformat(end_date.replace("Z", "+00:00").replace(" ", "T"))
                dt_end = parsed.astimezone(timezone.utc).replace(tzinfo=None) if parsed.tzinfo else parsed
            else:
                dt_end = _ist_end_to_utc_naive(date.fromisoformat(end_date))
        except Exception:
            pass

    return dt_start or _ist_start_to_utc_naive(date(today_ist.year, today_ist.month, 1)), dt_end or now_utc_naive


# ─── GST Report ──────────────────────────────────────────────────────────────

@router.get("/gst", response_model=GstReportSummary)
def gst_report(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2020),
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(500, ge=1, le=5000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop_id = getattr(current_user, "shop_id", 1) or 1
    base_query = db.query(GstTransaction).filter(GstTransaction.shop_id == shop_id)
    if month and year:
        m_start, m_end = _ist_month_bounds_utc_naive(year, month)
        base_query = base_query.filter(
            GstTransaction.transaction_date >= m_start,
            GstTransaction.transaction_date <= m_end,
        )
    elif from_date and to_date:
        base_query = base_query.filter(
            GstTransaction.transaction_date >= _ist_start_to_utc_naive(from_date),
            GstTransaction.transaction_date <= _ist_end_to_utc_naive(to_date),
        )

    # SQL GROUP BY across ALL GST slabs (0%, 5%, 12%, 18%, 28% + any custom slab — B5 & B6)
    slab_rows = (
        base_query.with_entities(
            GstTransaction.gst_rate,
            func.coalesce(func.sum(GstTransaction.taxable_amount), Decimal("0")).label("taxable"),
            func.coalesce(func.sum(GstTransaction.gst_amount), Decimal("0")).label("gst"),
        )
        .group_by(GstTransaction.gst_rate)
        .all()
    )

    slab_map: Dict[Decimal, Dict[str, Decimal]] = {
        slab: {"taxable": Decimal("0"), "gst": Decimal("0")}
        for slab in _STANDARD_GST_SLABS
    }
    total_taxable = Decimal("0")
    total_gst = Decimal("0")

    for row in slab_rows:
        rate_key = Decimal(str(row.gst_rate or 0)).normalize()
        # Normalize 0.00 -> 0, 5.00 -> 5, 12.00 -> 12, etc.
        if rate_key == rate_key.to_integral_value():
            rate_key = rate_key.quantize(Decimal("1"))
        taxable_val = Decimal(str(row.taxable or 0))
        gst_val = Decimal(str(row.gst or 0))
        total_taxable += taxable_val
        total_gst += gst_val
        if rate_key not in slab_map:
            slab_map[rate_key] = {"taxable": Decimal("0"), "gst": Decimal("0")}
        slab_map[rate_key]["taxable"] += taxable_val
        slab_map[rate_key]["gst"] += gst_val

    gst5_sales = slab_map[Decimal("5")]["taxable"]
    gst5_amount = slab_map[Decimal("5")]["gst"]
    gst18_sales = slab_map[Decimal("18")]["taxable"]
    gst18_amount = slab_map[Decimal("18")]["gst"]

    gst_breakdown = [
        {
            "gst_rate": float(rate),
            "taxable_value": float(vals["taxable"]),
            "cgst": float(vals["gst"] / Decimal("2")),
            "sgst": float(vals["gst"] / Decimal("2")),
            "igst": 0.0,
            "total_tax": float(vals["gst"]),
        }
        for rate, vals in sorted(slab_map.items(), key=lambda kv: kv[0])
    ]

    # Paginated ledger rows (summary totals above remain exact across all rows)
    transactions = (
        base_query.order_by(GstTransaction.transaction_date.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    rows = [
        GstReportRow(
            transaction_date=tx.transaction_date,
            invoice_number=tx.invoice_number,
            taxable_amount=tx.taxable_amount,
            gst_rate=tx.gst_rate,
            gst_amount=tx.gst_amount,
            total=tx.taxable_amount + tx.gst_amount,
        )
        for tx in transactions
    ]

    period = f"{month}/{year}" if month and year else (
        f"{from_date} to {to_date}" if from_date else "All Time"
    )

    return {
        "period": period,
        "from_date": str(from_date) if from_date else None,
        "to_date": str(to_date) if to_date else None,
        "total_sales": float(total_taxable + total_gst),
        "taxable_amount": float(total_taxable),
        "total_taxable": float(total_taxable),
        "total_cgst": float(total_gst / Decimal("2")),
        "total_sgst": float(total_gst / Decimal("2")),
        "total_igst": 0.0,
        "total_gst": float(total_gst),
        "total_tax": float(total_gst),
        "gst_5_sales": float(gst5_sales),
        "gst_5_amount": float(gst5_amount),
        "gst_18_sales": float(gst18_sales),
        "gst_18_amount": float(gst18_amount),
        "gst_breakdown": gst_breakdown,
        "rows": [
            {
                "transaction_date": r.transaction_date.isoformat(),
                "invoice_number": r.invoice_number,
                "taxable_amount": float(r.taxable_amount),
                "gst_rate": float(r.gst_rate),
                "gst_amount": float(r.gst_amount),
                "total": float(r.total),
            }
            for r in rows
        ],
    }


# ─── Stock Report ─────────────────────────────────────────────────────────────

@router.get("/stock")
def stock_report(
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(500, ge=1, le=2000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop_id = getattr(current_user, "shop_id", 1) or 1
    base_query = db.query(Product).filter(
        Product.shop_id == shop_id,
        Product.is_active == True,
    )

    # Exact totals computed in SQL instead of loading every SKU into RAM (B5)
    agg = base_query.with_entities(
        func.count(Product.id).label("cnt"),
        func.coalesce(func.sum(Product.current_stock), 0).label("units"),
        func.coalesce(func.sum(Product.current_stock * Product.purchase_price), 0).label("cost_val"),
        func.coalesce(func.sum(Product.current_stock * Product.selling_price), 0).label("retail_val"),
    ).first()

    total_count = int(agg.cnt or 0) if agg else 0
    tot_units = float(agg.units or 0) if agg else 0.0
    tot_cost = float(agg.cost_val or 0) if agg else 0.0
    tot_retail = float(agg.retail_val or 0) if agg else 0.0

    products = base_query.order_by(Product.product_name.asc()).offset(skip).limit(limit).all()

    items_list = [
        {
            "id": p.id,
            "product_id": p.id,
            "name": p.product_name,
            "product_name": p.product_name,
            "batch": p.product_code or f"BAT-{p.id}",
            "batch_number": p.product_code or f"BAT-{p.id}",
            "stock": float(p.current_stock or 0),
            "current_stock": float(p.current_stock or 0),
            "unit": p.unit.value if hasattr(p.unit, "value") else str(p.unit),
            "cost_price": float(p.purchase_price or 0),
            "sell_price": float(p.selling_price or 0),
            "selling_price": float(p.selling_price or 0),
            "cost_value": float((p.current_stock or 0) * (p.purchase_price or 0)),
            "retail_value": float((p.current_stock or 0) * (p.selling_price or 0)),
            "stock_value": float((p.current_stock or 0) * (p.selling_price or 0)),
        }
        for p in products
    ]

    return {
        "total_items_count": total_count,
        "total_units": tot_units,
        "total_cost_value": tot_cost,
        "total_retail_value": tot_retail,
        "estimated_margin": tot_retail - tot_cost,
        "items": items_list,
    }


# ─── Profit & Loss ────────────────────────────────────────────────────────────

@router.get("/profit-loss")
def profit_loss(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2020),
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop_id = getattr(current_user, "shop_id", 1) or 1
    sale_filters = [Sale.shop_id == shop_id]
    return_filters = [SalesReturn.shop_id == shop_id]
    exp_filters = [Expense.shop_id == shop_id]

    if month and year:
        m_start, m_end = _ist_month_bounds_utc_naive(year, month)
        first_day = date(year, month, 1)
        last_day = (date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)) - timedelta(days=1)
        sale_filters.extend([Sale.sale_date >= m_start, Sale.sale_date <= m_end])
        return_filters.extend([SalesReturn.return_date >= m_start, SalesReturn.return_date <= m_end])
        exp_filters.extend([Expense.expense_date >= first_day, Expense.expense_date <= last_day])
    elif from_date and to_date:
        d_start = _ist_start_to_utc_naive(from_date)
        d_end = _ist_end_to_utc_naive(to_date)
        sale_filters.extend([Sale.sale_date >= d_start, Sale.sale_date <= d_end])
        return_filters.extend([SalesReturn.return_date >= d_start, SalesReturn.return_date <= d_end])
        exp_filters.extend([Expense.expense_date >= from_date, Expense.expense_date <= to_date])

    # Pure SQL aggregations netting out SalesReturn refunds & returned COGS (B5, B6, SD2)
    gross_sales = db.query(func.coalesce(func.sum(Sale.grand_total), Decimal("0"))).filter(*sale_filters).scalar() or Decimal("0")
    total_returns = db.query(func.coalesce(func.sum(SalesReturn.refund_grand_total), Decimal("0"))).filter(*return_filters).scalar() or Decimal("0")
    total_sales = gross_sales - total_returns

    gross_cogs = (
        db.query(func.coalesce(func.sum(SaleItem.quantity * _effective_cost_expr()), Decimal("0")))
        .join(Sale, Sale.id == SaleItem.sale_id)
        .outerjoin(Product, Product.id == SaleItem.product_id)
        .filter(*sale_filters)
        .scalar()
    ) or Decimal("0")
    returned_cogs = (
        db.query(func.coalesce(func.sum(SalesReturnItem.returned_quantity * _effective_return_cost_expr()), Decimal("0")))
        .join(SalesReturn, SalesReturn.id == SalesReturnItem.sales_return_id)
        .outerjoin(Product, Product.id == SalesReturnItem.product_id)
        .filter(*return_filters)
        .scalar()
    ) or Decimal("0")
    cogs = gross_cogs - returned_cogs

    exp_rows = (
        db.query(Expense.category, func.coalesce(func.sum(Expense.amount), Decimal("0")).label("total"))
        .filter(*exp_filters)
        .group_by(Expense.category)
        .all()
    )
    exp_by_cat: Dict[str, float] = {}
    total_expenses = Decimal("0")
    for cat, amt in exp_rows:
        cat_str = cat.value if hasattr(cat, "value") else str(cat)
        amt_dec = Decimal(str(amt or 0))
        exp_by_cat[cat_str] = float(amt_dec)
        total_expenses += amt_dec

    period = f"{month}/{year}" if month and year else (
        f"{from_date} to {to_date}" if from_date else "All Time"
    )

    t_sales = float(total_sales)
    cogs_f = float(cogs)
    g_profit = t_sales - cogs_f
    tot_exp = float(total_expenses)
    n_profit = g_profit - tot_exp
    g_margin_pct = round((g_profit / t_sales * 100), 2) if t_sales > 0 else 0.0
    n_profit_pct = round((n_profit / t_sales * 100), 2) if t_sales > 0 else 0.0

    return {
        "period": period,
        "gross_sales": float(gross_sales),
        "total_returns": float(total_returns),
        "total_sales": t_sales,
        "sales_revenue": t_sales,
        "cost_of_goods": cogs_f,
        "cogs": cogs_f,
        "gross_profit": g_profit,
        "gross_margin_percent": g_margin_pct,
        "total_expenses": tot_exp,
        "operating_expenses": tot_exp,
        "net_profit": n_profit,
        "net_profit_percent": n_profit_pct,
        "expenses_by_category": exp_by_cat,
    }


# ─── Dashboard Summary ────────────────────────────────────────────────────────

@router.get("/dashboard")
def dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop_id = getattr(current_user, "shop_id", 1) or 1
    today = datetime.now(_IST).date()
    today_start = _ist_start_to_utc_naive(today)
    today_end = _ist_end_to_utc_naive(today)
    month_start = _ist_start_to_utc_naive(date(today.year, today.month, 1))

    today_gross_sales = db.query(func.sum(Sale.grand_total)).filter(
        Sale.shop_id == shop_id,
        Sale.sale_date >= today_start,
        Sale.sale_date <= today_end,
    ).scalar() or Decimal("0")
    today_returns = db.query(func.sum(SalesReturn.refund_grand_total)).filter(
        SalesReturn.shop_id == shop_id,
        SalesReturn.return_date >= today_start,
        SalesReturn.return_date <= today_end,
    ).scalar() or Decimal("0")
    today_sales = today_gross_sales - today_returns

    today_gst = db.query(func.sum(GstTransaction.gst_amount)).filter(
        GstTransaction.shop_id == shop_id,
        GstTransaction.transaction_date >= today_start,
        GstTransaction.transaction_date <= today_end,
    ).scalar() or Decimal("0")

    today_bills = db.query(func.count(Sale.id)).filter(
        Sale.shop_id == shop_id,
        Sale.sale_date >= today_start,
        Sale.sale_date <= today_end,
    ).scalar() or 0

    monthly_gross_sales = db.query(func.sum(Sale.grand_total)).filter(
        Sale.shop_id == shop_id,
        Sale.sale_date >= month_start,
    ).scalar() or Decimal("0")
    monthly_returns = db.query(func.sum(SalesReturn.refund_grand_total)).filter(
        SalesReturn.shop_id == shop_id,
        SalesReturn.return_date >= month_start,
    ).scalar() or Decimal("0")
    monthly_sales = monthly_gross_sales - monthly_returns

    monthly_expenses = db.query(func.sum(Expense.amount)).filter(
        Expense.shop_id == shop_id,
        Expense.expense_date >= date(today.year, today.month, 1),
    ).scalar() or Decimal("0")

    month_gross_cogs = (
        db.query(func.sum(SaleItem.quantity * _effective_cost_expr()))
        .join(Sale, Sale.id == SaleItem.sale_id)
        .outerjoin(Product, Product.id == SaleItem.product_id)
        .filter(
            Sale.shop_id == shop_id,
            Sale.sale_date >= month_start,
        )
        .scalar()
    ) or Decimal("0")
    month_returned_cogs = (
        db.query(func.sum(SalesReturnItem.returned_quantity * _effective_return_cost_expr()))
        .join(SalesReturn, SalesReturn.id == SalesReturnItem.sales_return_id)
        .outerjoin(Product, Product.id == SalesReturnItem.product_id)
        .filter(
            SalesReturn.shop_id == shop_id,
            SalesReturn.return_date >= month_start,
        )
        .scalar()
    ) or Decimal("0")
    month_cogs = month_gross_cogs - month_returned_cogs

    month_net_profit = monthly_sales - month_cogs - monthly_expenses

    total_products = db.query(func.count(Product.id)).filter(
        Product.shop_id == shop_id,
        Product.is_active == True,
    ).scalar() or 0

    stock_value = db.query(
        func.sum(Product.current_stock * Product.selling_price)
    ).filter(
        Product.shop_id == shop_id,
        Product.is_active == True,
    ).scalar() or Decimal("0")

    low_stock_query = db.query(Product).filter(
        Product.shop_id == shop_id,
        Product.is_active == True,
        Product.current_stock <= Product.minimum_stock,
    )
    low_stock = low_stock_query.count()
    low_stock_prods = low_stock_query.limit(10).all()

    next_m = today.month + 3
    next_y = today.year + (next_m - 1) // 12
    next_m = ((next_m - 1) % 12) + 1
    limit_ym = f"{next_y:04d}-{next_m:02d}"

    near_expiry_query = db.query(Product).filter(
        Product.shop_id == shop_id,
        Product.is_active == True,
        Product.expiry_date.isnot(None),
        Product.expiry_date != "",
        Product.expiry_date <= limit_ym,
    )
    near_expiry = near_expiry_query.count()
    near_expiry_prods = near_expiry_query.limit(10).all()

    recent_sales_list = db.query(Sale).filter(
        Sale.shop_id == shop_id
    ).order_by(Sale.sale_date.desc()).limit(5).all()

    def serialize_product(p: Product):
        return {
            "id": p.id,
            "name": p.product_name,
            "product_name": p.product_name,
            "product_code": p.product_code,
            "category": getattr(p, "category", None) or "Fertilizer",
            "company_name": p.company_name,
            "hsn_code": p.hsn_code or "",
            "unit": p.unit.value if hasattr(p.unit, "value") else str(p.unit),
            "current_stock": float(p.current_stock or 0),
            "cost_price": float(p.purchase_price or 0),
            "purchase_price": float(p.purchase_price or 0),
            "selling_price": float(p.selling_price or 0),
            "mrp": float(p.selling_price or 0),
            "gst_rate": float(p.gst_rate or 0),
            "batch_number": getattr(p, "batch_number", None) or p.product_code or f"BAT-{p.id}",
            "expiry_date": p.expiry_date,
            "min_stock_level": float(p.minimum_stock or 0),
            "minimum_stock": float(p.minimum_stock or 0),
            "is_active": p.is_active,
        }

    def serialize_sale(s: Sale):
        is_inter = bool(getattr(s, "is_interstate", False))
        gst_val = s.gst_amount or Decimal("0")
        igst_val = getattr(s, "total_igst", None)
        if igst_val is None:
            igst_val = gst_val if is_inter else Decimal("0")
        cgst_val = Decimal("0") if is_inter else (gst_val / Decimal("2"))
        return {
            "id": s.id,
            "invoice_number": s.invoice_number,
            "invoice_date": s.sale_date.isoformat() if s.sale_date else datetime.now(timezone.utc).isoformat(),
            "sale_date": s.sale_date.isoformat() if s.sale_date else datetime.now(timezone.utc).isoformat(),
            "customer_name": s.customer_name or "Farmer / Customer",
            "customer_phone": s.customer_phone or "",
            "payment_mode": s.payment_method.value if hasattr(s.payment_method, "value") else str(s.payment_method),
            "payment_method": s.payment_method.value if hasattr(s.payment_method, "value") else str(s.payment_method),
            "is_interstate": is_inter,
            "subtotal": float(s.subtotal or 0),
            "total_discount": float(getattr(s, "total_discount", 0) or 0),
            "total_taxable": float(s.subtotal or 0),
            "total_cgst": float(cgst_val),
            "total_sgst": float(cgst_val),
            "total_igst": float(igst_val),
            "gst_amount": float(gst_val),
            "round_off": float(getattr(s, "round_off", 0) or 0),
            "grand_total": float(s.grand_total or 0),
            "status": "Completed",
            "notes": s.notes or "",
            "items": [],
        }

    out_of_stock = db.query(func.count(Product.id)).filter(
        Product.shop_id == shop_id,
        Product.is_active == True,
        Product.current_stock == 0,
    ).scalar() or 0

    return {
        "today_sales": float(today_sales),
        "today_gst": float(today_gst),
        "today_bills": today_bills,
        "month_sales": float(monthly_sales),
        "monthly_sales": float(monthly_sales),
        "month_purchases": 0.0,
        "month_expenses": float(monthly_expenses),
        "month_net_profit": float(month_net_profit),
        "total_products": total_products,
        "stock_value": float(stock_value),
        "total_inventory_value": float(stock_value),
        "low_stock": low_stock,
        "low_stock_count": low_stock,
        "near_expiry_count": near_expiry,
        "out_of_stock": out_of_stock,
        "recent_sales": [serialize_sale(s) for s in recent_sales_list],
        "low_stock_products": [serialize_product(p) for p in low_stock_prods],
        "near_expiry_products": [serialize_product(p) for p in near_expiry_prods],
    }


# ─── Analytics Endpoint (SQL GROUP BY Aggregations — B5 & B6) ────────────────

def _build_category_skeleton(products: List[Product]) -> Tuple[Dict[str, Dict[str, Any]], Dict[int, str]]:
    cat_map: Dict[str, Dict[str, Any]] = {
        cat: {
            "category": cat,
            "product_count": 0,
            "stock_units": 0.0,
            "stock_value": 0.0,
            "units_sold": 0.0,
            "orders": 0,
            "revenue": 0.0,
            "cogs": 0.0,
            "profit": 0.0,
            "percentage": 0.0,
            "products_map": {},
        }
        for cat in _STANDARD_CATEGORIES
    }
    prod_cat_map: Dict[int, str] = {}

    for p in products:
        p_cat = (getattr(p, "category", None) or "Fertilizer").strip()
        if not p_cat or (p.company_name and p_cat == p.company_name):
            p_cat = "Fertilizer"
        matched_cat = next((c for c in cat_map if c.lower() == p_cat.lower()), None)
        if not matched_cat:
            matched_cat = p_cat
            cat_map[matched_cat] = {
                "category": matched_cat,
                "product_count": 0,
                "stock_units": 0.0,
                "stock_value": 0.0,
                "units_sold": 0.0,
                "orders": 0,
                "revenue": 0.0,
                "cogs": 0.0,
                "profit": 0.0,
                "percentage": 0.0,
                "products_map": {},
            }
        prod_cat_map[p.id] = matched_cat
        if not p.is_active:
            continue

        stock_qty = float(p.current_stock or 0)
        s_price = float(p.selling_price or 0)
        c_price = float(p.purchase_price or 0)
        unit_str = p.unit.value if hasattr(p.unit, "value") else str(p.unit or "Bags")

        cat_map[matched_cat]["product_count"] += 1
        cat_map[matched_cat]["stock_units"] += stock_qty
        cat_map[matched_cat]["stock_value"] += stock_qty * s_price
        cat_map[matched_cat]["products_map"][p.id] = {
            "id": p.id,
            "product_name": p.product_name,
            "trade_name": getattr(p, "trade_name", None) or "",
            "company_name": p.company_name or "",
            "category": matched_cat,
            "barcode": p.barcode or str(10000 + p.id),
            "batch_number": getattr(p, "batch_number", None) or p.product_code or "",
            "unit": unit_str,
            "current_stock": stock_qty,
            "selling_price": s_price,
            "cost_price": c_price,
            "units_sold": 0.0,
            "revenue": 0.0,
            "profit": 0.0,
            "orders": 0,
        }
    return cat_map, prod_cat_map


@router.get("/analytics")
def get_analytics(
    start_date: Optional[str] = Query(None, description="ISO format datetime or YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="ISO format datetime or YYYY-MM-DD"),
    preset: Optional[str] = Query("this_month", description="today | yesterday | last_7_days | this_month | last_month | all"),
    include_all_products: bool = Query(False, description="Return all products per category instead of top 50"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop_id = getattr(current_user, "shop_id", 1) or 1
    dt_start, dt_end = _resolve_date_window(preset, start_date, end_date)
    sale_filters = [
        Sale.shop_id == shop_id,
        Sale.sale_date >= dt_start,
        Sale.sale_date <= dt_end,
    ]
    return_filters = [
        SalesReturn.shop_id == shop_id,
        SalesReturn.return_date >= dt_start,
        SalesReturn.return_date <= dt_end,
    ]

    # 1. Summary KPIs via SQL aggregate (net of SalesReturn credit notes — SD2)
    summary_row = db.query(
        func.count(Sale.id).label("bills"),
        func.coalesce(func.sum(Sale.grand_total), 0).label("revenue"),
        func.coalesce(func.sum(Sale.subtotal), 0).label("taxable"),
        func.coalesce(func.sum(Sale.gst_amount), 0).label("gst"),
    ).filter(*sale_filters).first()

    return_summary = db.query(
        func.coalesce(func.sum(SalesReturn.refund_grand_total), 0).label("refund"),
        func.coalesce(func.sum(SalesReturn.refund_subtotal), 0).label("taxable"),
        func.coalesce(func.sum(SalesReturn.refund_gst_amount), 0).label("gst"),
    ).filter(*return_filters).first()

    total_bills = int(summary_row.bills or 0) if summary_row else 0
    total_returns = float(return_summary.refund or 0) if return_summary else 0.0
    total_revenue = (float(summary_row.revenue or 0) if summary_row else 0.0) - total_returns
    total_taxable = (float(summary_row.taxable or 0) if summary_row else 0.0) - (
        float(return_summary.taxable or 0) if return_summary else 0.0
    )
    total_gst = (float(summary_row.gst or 0) if summary_row else 0.0) - (
        float(return_summary.gst or 0) if return_summary else 0.0
    )

    # 2. Total COGS via SQL aggregate (immutable SaleItem/SalesReturnItem cost_price snapshot — B6 & SD2)
    gross_cogs = float(
        db.query(func.coalesce(func.sum(SaleItem.quantity * _effective_cost_expr()), 0))
        .join(Sale, Sale.id == SaleItem.sale_id)
        .outerjoin(Product, Product.id == SaleItem.product_id)
        .filter(*sale_filters)
        .scalar()
        or 0
    )
    returned_cogs = float(
        db.query(func.coalesce(func.sum(SalesReturnItem.returned_quantity * _effective_return_cost_expr()), 0))
        .join(SalesReturn, SalesReturn.id == SalesReturnItem.sales_return_id)
        .outerjoin(Product, Product.id == SalesReturnItem.product_id)
        .filter(*return_filters)
        .scalar()
        or 0
    )
    total_cogs = gross_cogs - returned_cogs

    # 3. Daily & Monthly series via SQL GROUP BY (IST calendar days, net of returns)
    day_col = _sql_day_expr(db, Sale.sale_date)
    daily_sales_rows = (
        db.query(
            day_col.label("day"),
            func.count(Sale.id).label("bills"),
            func.coalesce(func.sum(Sale.grand_total), 0).label("revenue"),
            func.coalesce(func.sum(Sale.subtotal), 0).label("taxable"),
            func.coalesce(func.sum(Sale.gst_amount), 0).label("gst"),
        )
        .filter(*sale_filters)
        .group_by(day_col)
        .order_by(day_col.asc())
        .all()
    )

    daily_cogs_rows = (
        db.query(
            day_col.label("day"),
            func.coalesce(func.sum(SaleItem.quantity * _effective_cost_expr()), 0).label("cogs"),
        )
        .join(Sale, Sale.id == SaleItem.sale_id)
        .outerjoin(Product, Product.id == SaleItem.product_id)
        .filter(*sale_filters)
        .group_by(day_col)
        .all()
    )
    daily_cogs_map = {str(r.day): float(r.cogs or 0) for r in daily_cogs_rows if r.day}

    ret_day_col = _sql_day_expr(db, SalesReturn.return_date)
    daily_ret_rows = (
        db.query(
            ret_day_col.label("day"),
            func.coalesce(func.sum(SalesReturn.refund_grand_total), 0).label("refund"),
            func.coalesce(func.sum(SalesReturn.refund_subtotal), 0).label("taxable"),
            func.coalesce(func.sum(SalesReturn.refund_gst_amount), 0).label("gst"),
        )
        .filter(*return_filters)
        .group_by(ret_day_col)
        .all()
    )
    daily_ret_map = {
        str(r.day): (float(r.refund or 0), float(r.taxable or 0), float(r.gst or 0))
        for r in daily_ret_rows if r.day
    }
    daily_ret_cogs_rows = (
        db.query(
            ret_day_col.label("day"),
            func.coalesce(func.sum(SalesReturnItem.returned_quantity * _effective_return_cost_expr()), 0).label("cogs"),
        )
        .join(SalesReturn, SalesReturn.id == SalesReturnItem.sales_return_id)
        .outerjoin(Product, Product.id == SalesReturnItem.product_id)
        .filter(*return_filters)
        .group_by(ret_day_col)
        .all()
    )
    daily_ret_cogs_map = {str(r.day): float(r.cogs or 0) for r in daily_ret_cogs_rows if r.day}

    day_series = []
    month_map: Dict[str, Dict[str, Any]] = {}
    for r in daily_sales_rows:
        if not r.day:
            continue
        day_str = str(r.day)
        parsed_day = datetime.strptime(day_str, "%Y-%m-%d")
        ret_rev, ret_sub, ret_gst = daily_ret_map.get(day_str, (0.0, 0.0, 0.0))
        rev = float(r.revenue or 0) - ret_rev
        sub = float(r.taxable or 0) - ret_sub
        gst = float(r.gst or 0) - ret_gst
        bills = int(r.bills or 0)
        d_cogs = daily_cogs_map.get(day_str, 0.0) - daily_ret_cogs_map.get(day_str, 0.0)
        d_profit = sub - d_cogs

        day_series.append({
            "date": day_str,
            "label": parsed_day.strftime("%d %b"),
            "revenue": round(rev, 2),
            "bills": bills,
            "gst": round(gst, 2),
            "profit": round(d_profit, 2),
            "cogs": round(d_cogs, 2),
        })

        m_key = parsed_day.strftime("%Y-%m")
        if m_key not in month_map:
            month_map[m_key] = {
                "month": m_key,
                "label": parsed_day.strftime("%b %Y"),
                "revenue": 0.0,
                "bills": 0,
                "gst": 0.0,
                "profit": 0.0,
            }
        month_map[m_key]["revenue"] += rev
        month_map[m_key]["bills"] += bills
        month_map[m_key]["gst"] += gst
        month_map[m_key]["profit"] += d_profit

    month_series = [
        {
            "month": k,
            "label": v["label"],
            "revenue": round(v["revenue"], 2),
            "bills": v["bills"],
            "gst": round(v["gst"], 2),
            "profit": round(v["profit"], 2),
        }
        for k, v in sorted(month_map.items())
    ]

    # 4. Hourly rush distribution via SQL GROUP BY (at most 24 rows)
    hour_col = _sql_hour_expr(db, Sale.sale_date)
    hour_rows = (
        db.query(
            hour_col.label("hr"),
            func.count(Sale.id).label("orders"),
            func.coalesce(func.sum(Sale.grand_total), 0).label("revenue"),
        )
        .filter(*sale_filters)
        .group_by(hour_col)
        .all()
    )
    hour_counts = [0] * 24
    hour_revenues = [0.0] * 24
    for r in hour_rows:
        if r.hr is not None:
            idx = int(r.hr)
            if 0 <= idx < 24:
                hour_counts[idx] = int(r.orders or 0)
                hour_revenues[idx] = float(r.revenue or 0)

    hourly_data = []
    for hr in range(24):
        period_ampm = "AM" if hr < 12 else "PM"
        display_hr = hr if hr <= 12 else hr - 12
        if display_hr == 0:
            display_hr = 12
        hourly_data.append({
            "hour": hr,
            "label": f"{display_hr} {period_ampm}",
            "orders": hour_counts[hr],
            "revenue": round(hour_revenues[hr], 2),
        })

    # 5. Payment method breakdown via SQL GROUP BY
    payment_rows = (
        db.query(
            Sale.payment_method,
            func.count(Sale.id).label("cnt"),
            func.coalesce(func.sum(Sale.grand_total), 0).label("amt"),
        )
        .filter(*sale_filters)
        .group_by(Sale.payment_method)
        .all()
    )
    payment_breakdown = []
    for pm, cnt, amt in payment_rows:
        pm_str = pm.value if hasattr(pm, "value") else str(pm)
        amt_f = float(amt or 0)
        pct = (amt_f / total_revenue * 100) if total_revenue > 0 else 0.0
        payment_breakdown.append({
            "method": pm_str,
            "count": int(cnt or 0),
            "amount": round(amt_f, 2),
            "percentage": round(pct, 1),
        })

    # 6. Category & per-product aggregates via SQL GROUP BY SaleItem.product_id
    products = db.query(Product).filter(Product.shop_id == shop_id).all()
    cat_map, prod_cat_map = _build_category_skeleton(products)

    per_product_rows = (
        db.query(
            SaleItem.product_id,
            func.coalesce(func.sum(SaleItem.quantity), 0).label("qty"),
            func.coalesce(func.sum(SaleItem.total), 0).label("rev"),
            func.coalesce(func.sum(SaleItem.quantity * _effective_cost_expr()), 0).label("cogs"),
            func.count(SaleItem.id).label("orders"),
        )
        .join(Sale, Sale.id == SaleItem.sale_id)
        .outerjoin(Product, Product.id == SaleItem.product_id)
        .filter(*sale_filters)
        .group_by(SaleItem.product_id)
        .all()
    )
    for row in per_product_rows:
        qty = float(row.qty or 0)
        rev = float(row.rev or 0)
        cost = float(row.cogs or 0)
        orders = int(row.orders or 0)
        matched_cat = prod_cat_map.get(row.product_id, "Others")
        cat_entry = cat_map[matched_cat]
        cat_entry["units_sold"] += qty
        cat_entry["orders"] += orders
        cat_entry["revenue"] += rev
        cat_entry["cogs"] += cost
        cat_entry["profit"] += (rev - cost)

        if row.product_id and row.product_id in cat_entry["products_map"]:
            p_stat = cat_entry["products_map"][row.product_id]
            p_stat["units_sold"] = round(qty, 2)
            p_stat["revenue"] = round(rev, 2)
            p_stat["profit"] = round(rev - cost, 2)
            p_stat["orders"] = orders

    # Subtract returned units/revenue/COGS per product (SD2)
    per_product_ret_rows = (
        db.query(
            SalesReturnItem.product_id,
            func.coalesce(func.sum(SalesReturnItem.returned_quantity), 0).label("qty"),
            func.coalesce(func.sum(SalesReturnItem.refund_total), 0).label("rev"),
            func.coalesce(func.sum(SalesReturnItem.returned_quantity * _effective_return_cost_expr()), 0).label("cogs"),
        )
        .join(SalesReturn, SalesReturn.id == SalesReturnItem.sales_return_id)
        .outerjoin(Product, Product.id == SalesReturnItem.product_id)
        .filter(*return_filters)
        .group_by(SalesReturnItem.product_id)
        .all()
    )
    for row in per_product_ret_rows:
        r_qty = float(row.qty or 0)
        r_rev = float(row.rev or 0)
        r_cost = float(row.cogs or 0)
        matched_cat = prod_cat_map.get(row.product_id, "Others")
        cat_entry = cat_map[matched_cat]
        cat_entry["units_sold"] -= r_qty
        cat_entry["revenue"] -= r_rev
        cat_entry["cogs"] -= r_cost
        cat_entry["profit"] -= (r_rev - r_cost)
        if row.product_id and row.product_id in cat_entry["products_map"]:
            p_stat = cat_entry["products_map"][row.product_id]
            p_stat["units_sold"] = round(p_stat["units_sold"] - r_qty, 2)
            p_stat["revenue"] = round(p_stat["revenue"] - r_rev, 2)
            p_stat["profit"] = round(p_stat["profit"] - (r_rev - r_cost), 2)

    category_breakdown = []
    for cat_name, c_data in cat_map.items():
        rev = round(c_data["revenue"], 2)
        pct = round((rev / total_revenue * 100), 1) if total_revenue > 0 else 0.0
        prods_list = sorted(
            c_data["products_map"].values(),
            key=lambda x: (x["revenue"], x["current_stock"]),
            reverse=True,
        )
        bounded_products = prods_list if include_all_products else prods_list[:_DEFAULT_CATEGORY_PRODUCTS_LIMIT]
        category_breakdown.append({
            "category": cat_name,
            "product_count": c_data["product_count"],
            "stock_units": round(c_data["stock_units"], 2),
            "stock_value": round(c_data["stock_value"], 2),
            "units_sold": round(c_data["units_sold"], 2),
            "orders": c_data["orders"],
            "revenue": rev,
            "cogs": round(c_data["cogs"], 2),
            "profit": round(c_data["profit"], 2),
            "percentage": pct,
            "products": bounded_products,
        })

    # 7. Top 10 products by revenue via SQL GROUP BY + LIMIT 10
    top_rows = (
        db.query(
            SaleItem.product_name,
            func.max(SaleItem.product_id).label("product_id"),
            func.max(SaleItem.net_content).label("unit"),
            func.coalesce(func.sum(SaleItem.quantity), 0).label("qty"),
            func.coalesce(func.sum(SaleItem.total), 0).label("rev"),
            func.coalesce(func.sum(SaleItem.quantity * _effective_cost_expr()), 0).label("cogs"),
            func.count(SaleItem.id).label("orders"),
        )
        .join(Sale, Sale.id == SaleItem.sale_id)
        .outerjoin(Product, Product.id == SaleItem.product_id)
        .filter(*sale_filters)
        .group_by(SaleItem.product_name)
        .order_by(func.sum(SaleItem.total).desc())
        .limit(10)
        .all()
    )
    top_products = [
        {
            "product_name": r.product_name or f"Product #{r.product_id}",
            "category": prod_cat_map.get(r.product_id, "Others"),
            "quantity": float(r.qty or 0),
            "revenue": round(float(r.rev or 0), 2),
            "cogs": round(float(r.cogs or 0), 2),
            "profit": round(float(r.rev or 0) - float(r.cogs or 0), 2),
            "orders": int(r.orders or 0),
            "unit": r.unit or "",
        }
        for r in top_rows
    ]

    gross_profit = total_taxable - total_cogs
    gross_margin = (gross_profit / total_taxable * 100) if total_taxable > 0 else 0.0
    avg_bill = (total_revenue / total_bills) if total_bills > 0 else 0.0

    return {
        "period": {
            "start": dt_start.isoformat(),
            "end": dt_end.isoformat(),
            "preset": preset,
        },
        "summary": {
            "total_revenue": round(total_revenue, 2),
            "total_returns": round(total_returns, 2),
            "total_taxable": round(total_taxable, 2),
            "total_gst": round(total_gst, 2),
            "total_bills": total_bills,
            "average_bill_value": round(avg_bill, 2),
            "total_cogs": round(total_cogs, 2),
            "gross_profit": round(gross_profit, 2),
            "gross_margin_percent": round(gross_margin, 1),
        },
        "day_wise": day_series,
        "monthly": month_series,
        "hourly": hourly_data,
        "payment_breakdown": payment_breakdown,
        "category_breakdown": category_breakdown,
        "top_products": top_products,
    }


@router.get("/export/pdf")
def export_report_pdf(
    report_type: str = Query(default="sales", description="sales | purchases | gst | stock | pnl"),
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    inline: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a standalone statutory/financial PDF report (never screen-printing web UI)."""
    shop_id = getattr(current_user, "shop_id", 1) or 1
    shop = db.query(ShopSettings).filter(ShopSettings.id == shop_id).first() or ShopSettings(
        shop_name="NockBill Agro Kendra"
    )
    rtype = (report_type or "sales").strip().lower()
    period_label = f"Period: {from_date} to {to_date}" if (from_date and to_date) else "Period: All Active Records"

    if rtype == "purchases":
        q = db.query(Purchase).filter(Purchase.shop_id == shop_id)
        if from_date and to_date:
            q = q.filter(
                Purchase.purchase_date >= _ist_start_to_utc_naive(from_date),
                Purchase.purchase_date <= _ist_end_to_utc_naive(to_date),
            )
        purchases = q.order_by(Purchase.purchase_date.desc()).limit(500).all()
        tot_sub = sum(Decimal(str(p.subtotal or 0)) for p in purchases)
        tot_gst = sum(Decimal(str(p.gst_amount or 0)) for p in purchases)
        tot_grand = sum(Decimal(str(p.grand_total or 0)) for p in purchases)
        pdf_bytes = generate_structured_table_pdf(
            shop=shop,
            document_title="INWARD PURCHASES & ITC REGISTER",
            subtitle=period_label,
            summary_metrics=[
                ("Consignments", str(len(purchases))),
                ("Taxable Inward", f"Rs.{tot_sub:,.2f}"),
                ("Eligible ITC (GST)", f"Rs.{tot_gst:,.2f}"),
                ("Total Inward Value", f"Rs.{tot_grand:,.2f}"),
            ],
            headers=["#", "Bill / Inv No", "Date", "Supplier", "Taxable (Rs.)", "GST (Rs.)", "Total (Rs.)"],
            rows=[
                [
                    str(idx),
                    p.invoice_number or f"PO-{p.id}",
                    p.purchase_date.strftime("%d/%m/%Y") if p.purchase_date else "-",
                    p.supplier_name or "Supplier Depot",
                    f"{Decimal(str(p.subtotal or 0)):,.2f}",
                    f"{Decimal(str(p.gst_amount or 0)):,.2f}",
                    f"{Decimal(str(p.grand_total or 0)):,.2f}",
                ]
                for idx, p in enumerate(purchases, 1)
            ],
            col_widths_mm=[10, 32, 24, 52, 24, 22, 26],
            right_align_cols=[4, 5, 6],
        )
        fname = f"Purchases_Register_{from_date or 'All'}.pdf"
    elif rtype == "gst":
        gst_data = gst_report(
            month=None,
            year=None,
            from_date=from_date,
            to_date=to_date,
            skip=0,
            limit=500,
            db=db,
            current_user=current_user,
        )
        slab_rows = gst_data.get("gst_breakdown") or []
        tx_rows = gst_data.get("rows") or []
        combined_rows: List[List[str]] = [
            [
                f"Slab {s['gst_rate']:g}%",
                "-",
                f"{Decimal(str(s['taxable_value'])):,.2f}",
                f"{Decimal(str(s['cgst'])):,.2f}",
                f"{Decimal(str(s['sgst'])):,.2f}",
                f"{Decimal(str(s['total_tax'])):,.2f}",
            ]
            for s in slab_rows
        ]
        for tx in tx_rows[:250]:
            half_gst = Decimal(str(tx["gst_amount"])) / Decimal("2")
            combined_rows.append(
                [
                    f"Inv ({tx['gst_rate']:g}%)",
                    str(tx["invoice_number"]),
                    f"{Decimal(str(tx['taxable_amount'])):,.2f}",
                    f"{half_gst:,.2f}",
                    f"{half_gst:,.2f}",
                    f"{Decimal(str(tx['gst_amount'])):,.2f}",
                ]
            )
        pdf_bytes = generate_structured_table_pdf(
            shop=shop,
            document_title="STATUTORY GST / GSTR-1 SUMMARY REPORT",
            subtitle=period_label,
            summary_metrics=[
                ("Gross Sales", f"Rs.{Decimal(str(gst_data['total_sales'])):,.2f}"),
                ("Taxable Value", f"Rs.{Decimal(str(gst_data['total_taxable'])):,.2f}"),
                ("CGST + SGST", f"Rs.{Decimal(str(gst_data['total_gst'])):,.2f}"),
                ("Invoices Logged", str(len(tx_rows))),
            ],
            headers=["Slab / Entry", "Invoice Ref", "Taxable (Rs.)", "CGST (Rs.)", "SGST (Rs.)", "Total Tax (Rs.)"],
            rows=combined_rows,
            col_widths_mm=[32, 42, 34, 26, 26, 30],
            right_align_cols=[2, 3, 4, 5],
        )
        fname = f"GST_GSTR1_Report_{from_date or 'All'}.pdf"
    elif rtype == "stock":
        stk = stock_report(from_date=from_date, to_date=to_date, skip=0, limit=500, db=db, current_user=current_user)
        items = stk.get("items") or []
        pdf_bytes = generate_structured_table_pdf(
            shop=shop,
            document_title="GODOWN STOCK BALANCE & VALUATION REGISTER",
            subtitle=period_label,
            summary_metrics=[
                ("Active SKUs", str(stk.get("total_products", len(items)))),
                ("Total Units", f"{Decimal(str(stk.get('total_stock_units', 0))):,.2f}"),
                ("Cost Valuation", f"Rs.{Decimal(str(stk.get('total_cost_value', 0))):,.2f}"),
                ("Retail Valuation", f"Rs.{Decimal(str(stk.get('total_retail_value', 0))):,.2f}"),
            ],
            headers=["#", "Product & Brand", "Category", "Batch", "Stock", "Rate (Rs.)", "Value (Rs.)"],
            rows=[
                [
                    str(idx),
                    f"{it.get('product_name', '')} ({it.get('company_name') or '-'})",
                    str(it.get("category") or "Fertilizer"),
                    str(it.get("batch_number") or "-"),
                    f"{it.get('current_stock', 0)} {it.get('unit', '')}",
                    f"{Decimal(str(it.get('selling_price', 0))):,.2f}",
                    f"{Decimal(str(it.get('stock_value', 0))):,.2f}",
                ]
                for idx, it in enumerate(items, 1)
            ],
            col_widths_mm=[10, 56, 26, 26, 24, 22, 26],
            right_align_cols=[4, 5, 6],
        )
        fname = f"Stock_Valuation_Report_{from_date or 'All'}.pdf"
    elif rtype == "pnl":
        q_sales = db.query(Sale).filter(Sale.shop_id == shop_id)
        q_exp = db.query(Expense).filter(Expense.shop_id == shop_id)
        if from_date and to_date:
            q_sales = q_sales.filter(
                Sale.sale_date >= _ist_start_to_utc_naive(from_date),
                Sale.sale_date <= _ist_end_to_utc_naive(to_date),
            )
            q_exp = q_exp.filter(Expense.expense_date >= from_date, Expense.expense_date <= to_date)
        sales_rows = q_sales.all()
        exp_rows = q_exp.all()
        rev = sum(Decimal(str(s.subtotal or 0)) for s in sales_rows)
        gross_sales = sum(Decimal(str(s.grand_total or 0)) for s in sales_rows)
        tot_exp = sum(Decimal(str(e.amount or 0)) for e in exp_rows)
        cogs = Decimal("0.00")
        for s in sales_rows:
            for it in s.items:
                cogs += Decimal(str(it.quantity or 0)) * Decimal(str(it.cost_price or 0))
        gross_prof = rev - cogs
        net_prof = gross_prof - tot_exp
        pdf_bytes = generate_structured_table_pdf(
            shop=shop,
            document_title="PROFIT & LOSS (P&L) FINANCIAL STATEMENT",
            subtitle=period_label,
            summary_metrics=[
                ("Gross Revenue", f"Rs.{gross_sales:,.2f}"),
                ("Net Taxable Sales", f"Rs.{rev:,.2f}"),
                ("Gross Profit", f"Rs.{gross_prof:,.2f}"),
                ("Net Profit", f"Rs.{net_prof:,.2f}"),
            ],
            headers=["Account Head", "Category", "Description", "Amount (Rs.)"],
            rows=[
                ["Operating Revenue", "Income", "Net Taxable Retail Sales", f"{rev:,.2f}"],
                ["Cost of Goods Sold (COGS)", "Direct Cost", "Batch-snapshot purchase cost of sold items", f"{cogs:,.2f}"],
                ["Gross Margin", "Subtotal", "Revenue minus COGS", f"{gross_prof:,.2f}"],
                ["Operating Expenses", "Indirect Cost", f"{len(exp_rows)} recorded store expense entries", f"{tot_exp:,.2f}"],
                ["Net Operating Profit", "Bottom Line", "Gross Profit minus Operating Expenses", f"{net_prof:,.2f}"],
            ],
            col_widths_mm=[48, 32, 74, 36],
            right_align_cols=[3],
        )
        fname = f"Profit_Loss_Statement_{from_date or 'All'}.pdf"
    else:
        q = db.query(Sale).filter(Sale.shop_id == shop_id)
        if from_date and to_date:
            q = q.filter(
                Sale.sale_date >= _ist_start_to_utc_naive(from_date),
                Sale.sale_date <= _ist_end_to_utc_naive(to_date),
            )
        sales_list = q.order_by(Sale.sale_date.desc()).limit(500).all()
        tot_taxable = sum(Decimal(str(s.subtotal or 0)) for s in sales_list)
        tot_gst = sum(Decimal(str(s.gst_amount or 0)) for s in sales_list)
        tot_grand = sum(Decimal(str(s.grand_total or 0)) for s in sales_list)
        pdf_bytes = generate_structured_table_pdf(
            shop=shop,
            document_title="RETAIL SALES & TAX INVOICE REGISTER",
            subtitle=period_label,
            summary_metrics=[
                ("Invoices", str(len(sales_list))),
                ("Taxable Value", f"Rs.{tot_taxable:,.2f}"),
                ("Included GST", f"Rs.{tot_gst:,.2f}"),
                ("Net Sales Total", f"Rs.{tot_grand:,.2f}"),
            ],
            headers=["#", "Invoice No", "Date", "Farmer / Customer", "Mode", "Taxable (Rs.)", "Total (Rs.)"],
            rows=[
                [
                    str(idx),
                    s.invoice_number,
                    s.sale_date.strftime("%d/%m/%Y") if s.sale_date else "-",
                    s.customer_name or "Walk-in Farmer",
                    s.payment_method.value if hasattr(s.payment_method, "value") else str(s.payment_method or "CASH"),
                    f"{Decimal(str(s.subtotal or 0)):,.2f}",
                    f"{Decimal(str(s.grand_total or 0)):,.2f}",
                ]
                for idx, s in enumerate(sales_list, 1)
            ],
            col_widths_mm=[10, 34, 22, 48, 22, 26, 28],
            right_align_cols=[5, 6],
        )
        fname = f"Sales_Register_{from_date or 'All'}.pdf"

    clean_fname = sanitize_download_filename(fname, fallback="NockBill_Report.pdf")
    disposition = "inline" if inline else "attachment"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'{disposition}; filename="{clean_fname}"'},
    )
