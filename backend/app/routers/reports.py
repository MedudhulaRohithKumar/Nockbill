from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, extract, and_
from typing import Optional, List
from decimal import Decimal
from datetime import date, datetime, timedelta
from app.database.base import get_db
from app.models.models import (
    Sale, SaleItem, Product, GstTransaction,
    InventoryTransaction, InventoryTxType, Expense, User
)
from app.schemas.schemas import GstReportSummary, GstReportRow, StockReportRow, ProfitLossReport
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/reports", tags=["Reports"])


# ─── GST Report ──────────────────────────────────────────────────────────────

@router.get("/gst", response_model=GstReportSummary)
def gst_report(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2020),
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop_id = getattr(current_user, "shop_id", 1) or 1
    query = db.query(GstTransaction).filter(GstTransaction.shop_id == shop_id)
    if month and year:
        query = query.filter(
            extract("month", GstTransaction.transaction_date) == month,
            extract("year", GstTransaction.transaction_date) == year,
        )
    elif from_date and to_date:
        query = query.filter(
            GstTransaction.transaction_date >= datetime.combine(from_date, datetime.min.time()),
            GstTransaction.transaction_date <= datetime.combine(to_date, datetime.max.time()),
        )
    transactions = query.order_by(GstTransaction.transaction_date).all()

    total_taxable = Decimal("0")
    total_gst = Decimal("0")
    gst5_sales = Decimal("0")
    gst5_amount = Decimal("0")
    gst18_sales = Decimal("0")
    gst18_amount = Decimal("0")
    rows = []

    for tx in transactions:
        total_taxable += tx.taxable_amount
        total_gst += tx.gst_amount
        if tx.gst_rate == Decimal("5"):
            gst5_sales += tx.taxable_amount
            gst5_amount += tx.gst_amount
        elif tx.gst_rate == Decimal("18"):
            gst18_sales += tx.taxable_amount
            gst18_amount += tx.gst_amount

        rows.append(GstReportRow(
            transaction_date=tx.transaction_date,
            invoice_number=tx.invoice_number,
            taxable_amount=tx.taxable_amount,
            gst_rate=tx.gst_rate,
            gst_amount=tx.gst_amount,
            total=tx.taxable_amount + tx.gst_amount,
        ))

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
        "gst_breakdown": [
            {
                "gst_rate": 5,
                "taxable_value": float(gst5_sales),
                "cgst": float(gst5_amount / Decimal("2")),
                "sgst": float(gst5_amount / Decimal("2")),
                "igst": 0.0,
                "total_tax": float(gst5_amount),
            },
            {
                "gst_rate": 18,
                "taxable_value": float(gst18_sales),
                "cgst": float(gst18_amount / Decimal("2")),
                "sgst": float(gst18_amount / Decimal("2")),
                "igst": 0.0,
                "total_tax": float(gst18_amount),
            },
        ],
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop_id = getattr(current_user, "shop_id", 1) or 1
    products = db.query(Product).filter(
        Product.shop_id == shop_id,
        Product.is_active == True
    ).all()

    tot_cost = sum(float((p.current_stock or 0) * (p.purchase_price or 0)) for p in products)
    tot_retail = sum(float((p.current_stock or 0) * (p.selling_price or 0)) for p in products)
    tot_units = sum(float(p.current_stock or 0) for p in products)

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
        "total_items_count": len(products),
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
    sale_query = db.query(Sale).filter(Sale.shop_id == shop_id)
    exp_query = db.query(Expense).filter(Expense.shop_id == shop_id)

    if month and year:
        sale_query = sale_query.filter(
            extract("month", Sale.sale_date) == month,
            extract("year", Sale.sale_date) == year,
        )
        exp_query = exp_query.filter(
            extract("month", Expense.expense_date) == month,
            extract("year", Expense.expense_date) == year,
        )
    elif from_date and to_date:
        sale_query = sale_query.filter(
            Sale.sale_date >= datetime.combine(from_date, datetime.min.time()),
            Sale.sale_date <= datetime.combine(to_date, datetime.max.time()),
        )
        exp_query = exp_query.filter(
            Expense.expense_date >= from_date,
            Expense.expense_date <= to_date,
        )

    sales = sale_query.all()
    sale_ids = [s.id for s in sales]
    expenses = exp_query.all()

    total_sales = sum((s.grand_total for s in sales), Decimal("0"))

    # Single aggregate query instead of N+1 Product lookups
    cogs = (
        db.query(func.sum(SaleItem.quantity * Product.purchase_price))
        .join(Product, Product.id == SaleItem.product_id)
        .filter(SaleItem.sale_id.in_(sale_ids))
        .scalar()
        if sale_ids else None
    ) or Decimal("0")

    total_expenses = sum((e.amount for e in expenses), Decimal("0"))
    gross_profit = total_sales - cogs
    net_profit = gross_profit - total_expenses

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

    exp_by_cat = {}
    for e in expenses:
        cat_str = e.category.value if hasattr(e.category, "value") else str(e.category)
        exp_by_cat[cat_str] = exp_by_cat.get(cat_str, 0.0) + float(e.amount)

    return {
        "period": period,
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
    today = date.today()
    today_start = datetime.combine(today, datetime.min.time())
    today_end = datetime.combine(today, datetime.max.time())
    month_start = datetime(today.year, today.month, 1)

    today_sales = db.query(func.sum(Sale.grand_total)).filter(
        Sale.shop_id == shop_id,
        Sale.sale_date >= today_start,
        Sale.sale_date <= today_end,
    ).scalar() or Decimal("0")

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

    monthly_sales = db.query(func.sum(Sale.grand_total)).filter(
        Sale.shop_id == shop_id,
        Sale.sale_date >= month_start,
    ).scalar() or Decimal("0")

    monthly_expenses = db.query(func.sum(Expense.amount)).filter(
        Expense.shop_id == shop_id,
        Expense.expense_date >= date(today.year, today.month, 1),
    ).scalar() or Decimal("0")

    # COGS for this month via a single SQL join (eliminates N+1 queries)
    month_cogs = (
        db.query(func.sum(SaleItem.quantity * Product.purchase_price))
        .join(Sale, Sale.id == SaleItem.sale_id)
        .join(Product, Product.id == SaleItem.product_id)
        .filter(
            Sale.shop_id == shop_id,
            Sale.sale_date >= month_start,
        )
        .scalar()
    ) or Decimal("0")

    month_net_profit = monthly_sales - month_cogs - monthly_expenses

    total_products = db.query(func.count(Product.id)).filter(
        Product.shop_id == shop_id,
        Product.is_active == True
    ).scalar() or 0

    stock_value = db.query(
        func.sum(Product.current_stock * Product.selling_price)
    ).filter(
        Product.shop_id == shop_id,
        Product.is_active == True
    ).scalar() or Decimal("0")

    # Low stock query
    low_stock_query = db.query(Product).filter(
        Product.shop_id == shop_id,
        Product.is_active == True,
        Product.current_stock <= Product.minimum_stock,
    )
    low_stock = low_stock_query.count()
    low_stock_prods = low_stock_query.limit(10).all()

    # Near expiry products (expiry within 90 days or stored as YYYY-MM)
    cur_ym = f"{today.year:04d}-{today.month:02d}"
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

    # Recent sales (top 5)
    recent_sales_list = db.query(Sale).filter(
        Sale.shop_id == shop_id
    ).order_by(Sale.sale_date.desc()).limit(5).all()

    def serialize_product(p: Product):
        return {
            "id": p.id,
            "name": p.product_name,
            "product_name": p.product_name,
            "product_code": p.product_code,
            "category": p.company_name or "Fertilizer",
            "company_name": p.company_name,
            "hsn_code": "31021000",
            "unit": p.unit.value if hasattr(p.unit, "value") else str(p.unit),
            "current_stock": float(p.current_stock or 0),
            "cost_price": float(p.purchase_price or 0),
            "purchase_price": float(p.purchase_price or 0),
            "selling_price": float(p.selling_price or 0),
            "mrp": float(p.selling_price or 0),
            "gst_rate": float(p.gst_rate or 0),
            "batch_number": p.product_code or f"BAT-{p.id}",
            "expiry_date": p.expiry_date,
            "min_stock_level": float(p.minimum_stock or 0),
            "minimum_stock": float(p.minimum_stock or 0),
            "is_active": p.is_active,
        }

    def serialize_sale(s: Sale):
        return {
            "id": s.id,
            "invoice_number": s.invoice_number,
            "invoice_date": s.sale_date.isoformat() if s.sale_date else datetime.utcnow().isoformat(),
            "sale_date": s.sale_date.isoformat() if s.sale_date else datetime.utcnow().isoformat(),
            "customer_name": s.customer_name or "Farmer / Customer",
            "customer_phone": s.customer_phone or "",
            "payment_mode": s.payment_method.value if hasattr(s.payment_method, "value") else str(s.payment_method),
            "payment_method": s.payment_method.value if hasattr(s.payment_method, "value") else str(s.payment_method),
            "is_interstate": False,
            "subtotal": float(s.subtotal or 0),
            "total_discount": 0.0,
            "total_taxable": float(s.subtotal or 0),
            "total_cgst": float((s.gst_amount or Decimal("0")) / Decimal("2")),
            "total_sgst": float((s.gst_amount or Decimal("0")) / Decimal("2")),
            "total_igst": 0.0,
            "gst_amount": float(s.gst_amount or 0),
            "round_off": 0.0,
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


# ─── Analytics Endpoint ───────────────────────────────────────────────────────

@router.get("/analytics")
def get_analytics(
    start_date: Optional[str] = Query(None, description="ISO format datetime or YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="ISO format datetime or YYYY-MM-DD"),
    preset: Optional[str] = Query("this_month", description="today | yesterday | last_7_days | this_month | last_month | all"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy.orm import selectinload
    shop_id = getattr(current_user, "shop_id", 1) or 1
    now = datetime.utcnow()

    # Determine date/time bounds
    dt_start = None
    dt_end = None

    if preset == "today":
        dt_start = datetime(now.year, now.month, now.day, 0, 0, 0)
        dt_end = datetime(now.year, now.month, now.day, 23, 59, 59)
    elif preset == "yesterday":
        yest = now - timedelta(days=1)
        dt_start = datetime(yest.year, yest.month, yest.day, 0, 0, 0)
        dt_end = datetime(yest.year, yest.month, yest.day, 23, 59, 59)
    elif preset == "last_7_days":
        dt_start = (now - timedelta(days=7)).replace(hour=0, minute=0, second=0, microsecond=0)
        dt_end = now
    elif preset == "this_month":
        dt_start = datetime(now.year, now.month, 1, 0, 0, 0)
        dt_end = now
    elif preset == "last_month":
        first_this = datetime(now.year, now.month, 1)
        last_month_end = first_this - timedelta(seconds=1)
        dt_start = datetime(last_month_end.year, last_month_end.month, 1, 0, 0, 0)
        dt_end = last_month_end
    elif preset == "all":
        dt_start = datetime(2020, 1, 1, 0, 0, 0)
        dt_end = now

    # Overwrite if explicit start_date or end_date are provided
    if start_date:
        try:
            if "T" in start_date or " " in start_date:
                clean_s = start_date.replace("Z", "").replace(" ", "T")
                dt_start = datetime.fromisoformat(clean_s)
            else:
                p_date = date.fromisoformat(start_date)
                dt_start = datetime.combine(p_date, datetime.min.time())
        except Exception:
            pass

    if end_date:
        try:
            if "T" in end_date or " " in end_date:
                clean_e = end_date.replace("Z", "").replace(" ", "T")
                dt_end = datetime.fromisoformat(clean_e)
            else:
                p_date = date.fromisoformat(end_date)
                dt_end = datetime.combine(p_date, datetime.max.time())
        except Exception:
            pass

    if not dt_start:
        dt_start = datetime(now.year, now.month, 1, 0, 0, 0)
    if not dt_end:
        dt_end = now

    # Fetch sales within window for this shop with eager-loaded items
    sales = db.query(Sale).options(selectinload(Sale.items)).filter(
        Sale.shop_id == shop_id,
        Sale.sale_date >= dt_start,
        Sale.sale_date <= dt_end,
    ).order_by(Sale.sale_date.asc()).all()

    # Pre-fetch products lookup for accurate COGS
    products = db.query(Product).filter(Product.shop_id == shop_id).all()
    prod_cost_map = {p.id: float(p.purchase_price or 0) for p in products}

    total_revenue = 0.0
    total_taxable = 0.0
    total_gst = 0.0
    total_cogs = 0.0
    total_bills = len(sales)

    # Buckets
    day_map = {}
    month_map = {}
    hour_counts = [0] * 24
    hour_revenues = [0.0] * 24
    payment_map = {}
    prod_sales_map = {}

    for s in sales:
        grand = float(s.grand_total or 0)
        sub = float(s.subtotal or 0)
        gst = float(s.gst_amount or 0)

        total_revenue += grand
        total_taxable += sub
        total_gst += gst

        # Sale COGS
        sale_cogs = 0.0
        for item in s.items:
            qty = float(item.quantity or 0)
            item_rev = float(item.total or 0)
            c_price = prod_cost_map.get(item.product_id, 0.0)
            cost = qty * c_price
            sale_cogs += cost

            # Product aggregation
            p_name = item.product_name or f"Product #{item.product_id}"
            if p_name not in prod_sales_map:
                prod_sales_map[p_name] = {
                    "product_name": p_name,
                    "quantity": 0.0,
                    "revenue": 0.0,
                    "cogs": 0.0,
                    "orders": 0,
                    "unit": item.net_content or ""
                }
            prod_sales_map[p_name]["quantity"] += qty
            prod_sales_map[p_name]["revenue"] += item_rev
            prod_sales_map[p_name]["cogs"] += cost
            prod_sales_map[p_name]["orders"] += 1

        total_cogs += sale_cogs
        sale_profit = sub - sale_cogs

        # Day bucket
        s_date = s.sale_date.strftime("%Y-%m-%d")
        d_label = s.sale_date.strftime("%d %b")
        if s_date not in day_map:
            day_map[s_date] = {
                "date": s_date,
                "label": d_label,
                "revenue": 0.0,
                "bills": 0,
                "gst": 0.0,
                "cogs": 0.0,
                "profit": 0.0,
            }
        day_map[s_date]["revenue"] += grand
        day_map[s_date]["bills"] += 1
        day_map[s_date]["gst"] += gst
        day_map[s_date]["cogs"] += sale_cogs
        day_map[s_date]["profit"] += sale_profit

        # Month bucket
        m_key = s.sale_date.strftime("%Y-%m")
        m_label = s.sale_date.strftime("%b %Y")
        if m_key not in month_map:
            month_map[m_key] = {
                "month": m_key,
                "label": m_label,
                "revenue": 0.0,
                "bills": 0,
                "gst": 0.0,
                "profit": 0.0,
            }
        month_map[m_key]["revenue"] += grand
        month_map[m_key]["bills"] += 1
        month_map[m_key]["gst"] += gst
        month_map[m_key]["profit"] += sale_profit

        # Hourly rush
        h = s.sale_date.hour
        hour_counts[h] += 1
        hour_revenues[h] += grand

        # Payment mode
        pm = s.payment_method.value if hasattr(s.payment_method, "value") else str(s.payment_method)
        if pm not in payment_map:
            payment_map[pm] = {"method": pm, "count": 0, "amount": 0.0}
        payment_map[pm]["count"] += 1
        payment_map[pm]["amount"] += grand

    gross_profit = total_taxable - total_cogs
    gross_margin = (gross_profit / total_taxable * 100) if total_taxable > 0 else 0.0
    avg_bill = (total_revenue / total_bills) if total_bills > 0 else 0.0

    # Hourly array
    hourly_data = []
    for hr in range(24):
        period = "AM" if hr < 12 else "PM"
        display_hr = hr if hr <= 12 else hr - 12
        if display_hr == 0:
            display_hr = 12
        label = f"{display_hr} {period}"
        hourly_data.append({
            "hour": hr,
            "label": label,
            "orders": hour_counts[hr],
            "revenue": round(hour_revenues[hr], 2),
        })

    # Sort days
    day_series = [
        {
            "date": k,
            "label": v["label"],
            "revenue": round(v["revenue"], 2),
            "bills": v["bills"],
            "gst": round(v["gst"], 2),
            "profit": round(v["profit"], 2),
            "cogs": round(v["cogs"], 2),
        }
        for k, v in sorted(day_map.items())
    ]

    # Sort months
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

    # Payment breakdown percentages
    payment_breakdown = []
    for pm, d in payment_map.items():
        pct = (d["amount"] / total_revenue * 100) if total_revenue > 0 else 0.0
        payment_breakdown.append({
            "method": pm,
            "count": d["count"],
            "amount": round(d["amount"], 2),
            "percentage": round(pct, 1),
        })

    # Top products by revenue
    top_products = sorted(
        prod_sales_map.values(),
        key=lambda x: x["revenue"],
        reverse=True
    )[:10]
    for tp in top_products:
        tp["revenue"] = round(tp["revenue"], 2)
        tp["profit"] = round(tp["revenue"] - tp["cogs"], 2)

    return {
        "period": {
            "start": dt_start.isoformat(),
            "end": dt_end.isoformat(),
            "preset": preset,
        },
        "summary": {
            "total_revenue": round(total_revenue, 2),
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
        "top_products": top_products,
    }

