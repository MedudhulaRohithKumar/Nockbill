from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import or_, func, desc
from typing import List, Optional, Dict, Any
from decimal import Decimal
from datetime import datetime, timedelta
import time

from app.database.base import get_db
from app.models.models import (
    Product, ProductVariant, ProductBatch, UnitType, User, AuditLog, AuditAction,
    InventoryTransaction, InventoryTxType, Purchase, PurchaseItem,
    Sale, SaleItem, ShopSettings
)
from app.schemas.schemas import ProductCreate, ProductUpdate, ProductResponse, ProductSearchResult, ProductRefillRequest
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/products", tags=["Products"])


def _generate_code(db: Session, shop_id: int = 1) -> str:
    all_codes = db.query(Product.product_code).filter(
        Product.shop_id == shop_id,
        Product.product_code.isnot(None)
    ).all()
    nums = []
    for (c,) in all_codes:
        if c and c.startswith("PRD"):
            try:
                nums.append(int(c.replace("PRD", "")))
            except ValueError:
                pass
    next_num = max(nums, default=0) + 1
    candidate = f"PRD{str(next_num).zfill(5)}"
    while db.query(Product).filter(Product.shop_id == shop_id, Product.product_code == candidate).first():
        next_num += 1
        candidate = f"PRD{str(next_num).zfill(5)}"
    return candidate


def _generate_barcode(db: Session, shop_id: int = 1) -> str:
    """Generate a clean 5-digit barcode number (e.g. 10001, 10002, 10003...) for fast desktop typing."""
    all_codes = db.query(Product.barcode).filter(
        Product.shop_id == shop_id,
        Product.barcode.isnot(None)
    ).all()
    numeric_codes = []
    for (b,) in all_codes:
        if b and b.isdigit() and len(b) == 5:
            numeric_codes.append(int(b))

    next_num = max(numeric_codes) + 1 if numeric_codes else 10001
    if next_num < 10001:
        next_num = 10001
    candidate = str(next_num)
    while db.query(Product).filter(Product.shop_id == shop_id, Product.barcode == candidate).first():
        next_num += 1
        candidate = str(next_num)
    return candidate


def serialize_product(p: Product) -> dict:
    unit_str = p.unit.value if hasattr(p.unit, "value") else str(p.unit or "Bags")
    barcode_val = p.barcode or str(10000 + p.id)
    hsn_val = p.hsn_code or "31021000"

    active_variants = []
    if hasattr(p, "variants") and p.variants:
        for v in p.variants:
            if getattr(v, "is_active", True):
                active_variants.append({
                    "id": v.id,
                    "variant_name": v.variant_name,
                    "unit_size": float(v.unit_size),
                    "unit": v.unit,
                    "purchase_price": float(v.purchase_price or 0),
                    "cost_price": float(v.purchase_price or 0),
                    "selling_price": float(v.selling_price or 0),
                    "mrp": float(v.mrp or v.selling_price or 0),
                    "stock": float(v.stock or 0),
                    "barcode": v.barcode or f"{barcode_val}-{v.id}",
                })

    if not active_variants:
        size = float(p.net_content) if p.net_content is not None else 1.0
        active_variants = [{
            "id": 0,
            "variant_name": f"{size:g} {unit_str}",
            "unit_size": size,
            "unit": unit_str,
            "purchase_price": float(p.purchase_price or 0),
            "cost_price": float(p.purchase_price or 0),
            "selling_price": float(p.selling_price or 0),
            "mrp": float(p.selling_price or 0),
            "stock": float(p.current_stock or 0),
            "barcode": barcode_val,
        }]

    # Multi-batch serialization with FIFO ordering
    active_batches = []
    if hasattr(p, "batches") and p.batches:
        for b in p.batches:
            if getattr(b, "is_active", True) and float(b.current_stock or 0) > 0:
                active_batches.append({
                    "id": b.id,
                    "product_id": b.product_id,
                    "batch_number": b.batch_number,
                    "manufacture_date": b.manufacture_date,
                    "expiry_date": b.expiry_date,
                    "purchase_price": float(b.purchase_price or 0),
                    "selling_price": float(b.selling_price or 0),
                    "mrp": float(b.mrp or b.selling_price or 0),
                    "current_stock": float(b.current_stock or 0),
                    "is_active": b.is_active,
                })
        if not active_batches:
            for b in p.batches:
                if getattr(b, "is_active", True):
                    active_batches.append({
                        "id": b.id,
                        "product_id": b.product_id,
                        "batch_number": b.batch_number,
                        "manufacture_date": b.manufacture_date,
                        "expiry_date": b.expiry_date,
                        "purchase_price": float(b.purchase_price or 0),
                        "selling_price": float(b.selling_price or 0),
                        "mrp": float(b.mrp or b.selling_price or 0),
                        "current_stock": float(b.current_stock or 0),
                        "is_active": b.is_active,
                    })

    if not active_batches:
        active_batches.append({
            "id": 0,
            "product_id": p.id,
            "batch_number": p.product_code or f"BAT-{p.id}",
            "manufacture_date": p.manufacture_date,
            "expiry_date": p.expiry_date or "2028-06",
            "purchase_price": float(p.purchase_price or 0),
            "selling_price": float(p.selling_price or 0),
            "mrp": float(p.selling_price or 0),
            "current_stock": float(p.current_stock or 0),
            "is_active": True,
        })
    active_batches.sort(key=lambda x: x.get("expiry_date") or "9999-99")

    return {
        "id": p.id,
        "product_code": p.product_code,
        "product_name": p.product_name,
        "name": p.product_name,
        "company_name": p.company_name,
        "category": p.company_name or "Fertilizer",
        "net_content": float(p.net_content) if p.net_content is not None else None,
        "unit": unit_str,
        "purchase_price": float(p.purchase_price or 0),
        "cost_price": float(p.purchase_price or 0),
        "selling_price": float(p.selling_price or 0),
        "mrp": float(p.selling_price or 0),
        "gst_rate": float(p.gst_rate or 0),
        "manufacture_date": p.manufacture_date,
        "expiry_date": p.expiry_date,
        "batch_number": p.product_code or f"BAT-{p.id}",
        "hsn_code": hsn_val,
        "barcode": barcode_val,
        "current_stock": float(p.current_stock or 0),
        "minimum_stock": float(p.minimum_stock or 0),
        "min_stock_level": float(p.minimum_stock or 0),
        "variants": active_variants,
        "batches": active_batches,
        "is_active": p.is_active,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


@router.get("/check-duplicate")
def check_duplicate(
    name: str = Query(..., min_length=1),
    company: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Check if a product already exists before adding."""
    shop_id = getattr(current_user, "shop_id", 1) or 1
    clean_name = name.strip()
    query = db.query(Product).filter(
        Product.shop_id == shop_id,
        Product.is_active == True,
        func.lower(Product.product_name) == clean_name.lower()
    )
    if company and company.strip():
        query = query.filter(func.lower(Product.company_name) == company.strip().lower())
    existing = query.first()
    if existing:
        return {
            "exists": True,
            "message": f"Product '{existing.product_name}' by '{existing.company_name or 'N/A'}' already exists (Stock: {existing.current_stock}). Please refill stock instead.",
            "product": serialize_product(existing)
        }
    return {"exists": False}


@router.get("/by-barcode/{barcode}")
def get_by_barcode(
    barcode: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Search product and specific packaging variant by barcode."""
    shop_id = getattr(current_user, "shop_id", 1) or 1
    barcode_clean = barcode.strip()
    
    # 1. Match exact product barcode or code
    p = db.query(Product).filter(
        Product.shop_id == shop_id,
        Product.is_active == True,
        or_(
            Product.barcode == barcode_clean,
            Product.product_code == barcode_clean
        )
    ).first()
    if p:
        p_data = serialize_product(p)
        return {
            "found": True,
            "product": p_data,
            "matched_variant": p_data["variants"][0] if p_data["variants"] else None
        }

    # 2. Match variant barcode
    variant = db.query(ProductVariant).filter(
        ProductVariant.barcode == barcode_clean,
        ProductVariant.is_active == True
    ).first()
    if variant and variant.product and variant.product.is_active:
        prod_data = serialize_product(variant.product)
        matched_v = next((v for v in prod_data["variants"] if v["id"] == variant.id), None)
        return {
            "found": True,
            "product": prod_data,
            "matched_variant": matched_v or {
                "id": variant.id,
                "variant_name": variant.variant_name,
                "unit_size": float(variant.unit_size),
                "unit": variant.unit,
                "purchase_price": float(variant.purchase_price or 0),
                "cost_price": float(variant.purchase_price or 0),
                "selling_price": float(variant.selling_price or 0),
                "mrp": float(variant.mrp or variant.selling_price or 0),
                "stock": float(variant.stock or 0),
                "barcode": variant.barcode
            }
        }

    # 3. Match batch number
    batch = db.query(ProductBatch).filter(
        ProductBatch.batch_number == barcode_clean,
        ProductBatch.is_active == True
    ).first()
    if batch and batch.product and batch.product.is_active:
        prod_data = serialize_product(batch.product)
        matched_b = next((b for b in prod_data["batches"] if b["id"] == batch.id), None)
        return {
            "found": True,
            "product": prod_data,
            "matched_variant": prod_data["variants"][0] if prod_data["variants"] else None,
            "matched_batch": matched_b
        }

    raise HTTPException(status_code=404, detail="No product found matching this barcode")


@router.get("/{product_id}/barcode-label.pdf")
def get_barcode_label_pdf(
    product_id: int,
    label_size: str = Query("50x25", description="Label size: 50x25, 50x30, 38x25, 2x1inch, a4_sheet"),
    copies: int = Query(1, ge=1, le=100),
    include_shop: bool = Query(True),
    include_price: bool = Query(True),
    include_batch: bool = Query(False),
    batch_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate exact label-sized barcode PDF or A4 multi-label sheet."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    shop = db.query(ShopSettings).first()
    shop_name = shop.shop_name if shop else "Kisan Seva Kendra"

    batch_number = None
    expiry_date = None
    if batch_id:
        batch = db.query(ProductBatch).filter(ProductBatch.id == batch_id).first()
        if batch:
            batch_number = batch.batch_number
            expiry_date = batch.expiry_date
    elif product.batches:
        batch_number = product.batches[0].batch_number
        expiry_date = product.batches[0].expiry_date

    barcode_val = product.barcode or str(10000 + product.id)
    price = product.selling_price or Decimal("0")

    from app.reports.barcode_pdf import generate_barcode_label_pdf
    pdf_bytes = generate_barcode_label_pdf(
        product_name=product.product_name,
        barcode=barcode_val,
        price=price,
        gst_rate=product.gst_rate,
        shop_name=shop_name,
        company_name=product.company_name,
        net_content=str(product.unit.value) if hasattr(product.unit, 'value') else str(product.unit or ''),
        batch_number=batch_number,
        expiry_date=expiry_date,
        label_size=label_size,
        copies=copies,
        include_shop=include_shop,
        include_price=include_price,
        include_batch=include_batch,
    )

    clean_name = product.product_name.replace(" ", "_")[:20]
    filename = f"Barcode_{clean_name}_{barcode_val}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'}
    )


@router.get("/recommend-refill")
def get_refill_recommendations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Recommend products that need replenishment based on:
    1. Stock <= minimum_stock (Critical)
    2. High sales frequency / run rate in the last 30 days
    3. Days of stock remaining < 7 days
    """
    shop_id = getattr(current_user, "shop_id", 1) or 1
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    
    # Calculate sales velocity per product in last 30 days
    sales_stats = db.query(
        SaleItem.product_id,
        func.sum(SaleItem.quantity).label("units_sold"),
        func.count(SaleItem.id).label("times_sold")
    ).join(Sale, Sale.id == SaleItem.sale_id).filter(
        Sale.shop_id == shop_id,
        Sale.sale_date >= thirty_days_ago
    ).group_by(SaleItem.product_id).all()

    sales_map = {
        s.product_id: {
            "units_sold": float(s.units_sold or 0),
            "times_sold": int(s.times_sold or 0),
            "daily_velocity": float(s.units_sold or 0) / 30.0
        }
        for s in sales_stats if s.product_id
    }

    products = db.query(Product).filter(
        Product.shop_id == shop_id,
        Product.is_active == True
    ).all()
    recommendations = []

    for p in products:
        c_stock = float(p.current_stock or 0)
        m_stock = float(p.minimum_stock or 5)
        stat = sales_map.get(p.id, {"units_sold": 0.0, "times_sold": 0, "daily_velocity": 0.0})
        daily_vel = stat["daily_velocity"]
        
        if daily_vel > 0:
            days_left = round(c_stock / daily_vel, 1)
        else:
            days_left = 999 if c_stock > 0 else 0

        urgency = "LOW"
        reason = "Normal stock level"

        if c_stock == 0:
            urgency = "CRITICAL"
            reason = "Out of Stock! Immediate replenishment needed."
        elif c_stock <= m_stock:
            urgency = "CRITICAL"
            reason = f"Below minimum safety threshold ({c_stock} ≤ {m_stock})."
        elif days_left <= 7:
            urgency = "HIGH"
            reason = f"Fast-moving product! Estimated stock runs out in {days_left} days."
        elif days_left <= 15 or stat["times_sold"] >= 5:
            urgency = "MEDIUM"
            reason = f"High demand product with {days_left} days remaining."

        if urgency in ["CRITICAL", "HIGH", "MEDIUM"]:
            rec_qty = max(m_stock * 2, round(daily_vel * 30 + m_stock - c_stock))
            if rec_qty <= 0:
                rec_qty = m_stock * 2

            prod_data = serialize_product(p)
            recommendations.append({
                "product_id": p.id,
                "product_name": p.product_name,
                "company_name": p.company_name,
                "current_stock": c_stock,
                "minimum_stock": m_stock,
                "unit": prod_data["unit"],
                "purchase_price": prod_data["purchase_price"],
                "selling_price": prod_data["selling_price"],
                "barcode": prod_data["barcode"],
                "units_sold_30d": stat["units_sold"],
                "times_sold_30d": stat["times_sold"],
                "daily_velocity": round(daily_vel, 2),
                "days_stock_remaining": days_left,
                "urgency": urgency,
                "reason": reason,
                "recommended_refill_quantity": rec_qty,
                "product": prod_data
            })

    priority_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
    recommendations.sort(key=lambda x: (priority_order[x["urgency"]], x["days_stock_remaining"]))
    return recommendations


@router.post("/refill")
def refill_stock(
    payload: ProductRefillRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Refill stock for an existing product:
    - Increments current_stock
    - Updates purchase and selling prices if supplied
    - Updates batch and expiry if supplied
    - Creates InventoryTransaction and Purchase record
    """
    shop_id = getattr(current_user, "shop_id", 1) or 1
    product = db.query(Product).filter(
        Product.id == payload.product_id,
        Product.shop_id == shop_id
    ).with_for_update().first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    qty = Decimal(str(payload.additional_quantity if payload.additional_quantity is not None else payload.quantity))
    prev_stock = product.current_stock or Decimal("0")
    product.current_stock = prev_stock + qty

    if payload.purchase_price is not None and payload.purchase_price > 0:
        product.purchase_price = Decimal(str(payload.purchase_price))

    if payload.selling_price is not None and payload.selling_price > 0:
        product.selling_price = Decimal(str(payload.selling_price))

    batch_no = (payload.new_batch_number or payload.batch_number or "").strip() or product.product_code or f"BAT-{product.id}"
    expiry_dt = (payload.new_expiry_date or payload.expiry_date or "").strip() or product.expiry_date or "2028-12"

    if expiry_dt:
        product.expiry_date = expiry_dt

    # Update or create ProductBatch for multi-batch tracking
    p_price = Decimal(str(payload.purchase_price)) if (payload.purchase_price is not None and Decimal(str(payload.purchase_price)) > 0) else (product.purchase_price or Decimal("0"))
    s_price_raw = Decimal(str(payload.selling_price)) if payload.selling_price is not None else None
    if s_price_raw is not None and s_price_raw > 0:
        s_price = s_price_raw
    else:
        s_price = product.selling_price or Decimal("0")
    # ProductBatch.selling_price is NOT NULL — ensure we never insert 0 or None
    if s_price <= Decimal("0"):
        s_price = p_price if p_price > 0 else Decimal("1")
    mrp_val = Decimal(str(payload.mrp)) if (payload.mrp is not None and Decimal(str(payload.mrp)) > 0) else s_price

    batch = db.query(ProductBatch).filter(
        ProductBatch.product_id == product.id,
        ProductBatch.batch_number == batch_no
    ).with_for_update().first()

    if batch:
        batch.current_stock = (batch.current_stock or Decimal("0")) + qty
        batch.expiry_date = expiry_dt
        batch.purchase_price = p_price
        batch.selling_price = s_price
        batch.mrp = mrp_val
        batch.is_active = True
    else:
        batch = ProductBatch(
            product_id=product.id,
            batch_number=batch_no,
            expiry_date=expiry_dt,
            purchase_price=p_price,
            selling_price=s_price,
            mrp=mrp_val,
            current_stock=qty,
            is_active=True
        )
        db.add(batch)

    # Create Inventory Transaction
    inv_tx = InventoryTransaction(
        shop_id=shop_id,
        product_id=product.id,
        transaction_type=InventoryTxType.PURCHASE,
        quantity=qty,
        previous_stock=prev_stock,
        new_stock=product.current_stock,
        reference_type="PURCHASE",
        notes=payload.notes or f"Stock refilled (+{qty} {product.unit.value if hasattr(product.unit, 'value') else product.unit}, Batch: {batch_no}, Exp: {expiry_dt}) via Refill Stock feature"
    )
    db.add(inv_tx)
    db.flush()

    # Create Purchase voucher / bill
    unit_str = payload.unit or (product.unit.value if hasattr(product.unit, "value") else str(product.unit))
    gst_rate = product.gst_rate or Decimal("0")
    taxable = qty * p_price
    gst_amount = (taxable * gst_rate / Decimal("100")).quantize(Decimal("0.01"))
    total_val = taxable + gst_amount

    purchase = Purchase(
        shop_id=shop_id,
        supplier_name=payload.supplier_name or product.company_name or "Stock Refill Supplier",
        invoice_number=payload.invoice_number or f"REF-{datetime.utcnow().strftime('%Y%m%d%H%M')}-{product.id}",
        purchase_date=datetime.utcnow(),
        subtotal=taxable,
        gst_amount=gst_amount,
        grand_total=total_val,
        notes=payload.notes or f"Quick Refill of {product.product_name} (Batch: {batch_no})",
        created_by=current_user.id
    )
    db.add(purchase)
    db.flush()

    purchase_item = PurchaseItem(
        purchase_id=purchase.id,
        product_id=product.id,
        product_name=product.product_name,
        unit=unit_str,
        batch_number=batch_no,
        expiry_date=expiry_dt,
        quantity=qty,
        purchase_price=p_price,
        gst_rate=gst_rate,
        total=total_val
    )
    db.add(purchase_item)

    db.add(AuditLog(
        user_id=current_user.id,
        action=AuditAction.INVENTORY_ADJUST,
        reference_id=product.id,
        reference_type="Product",
        description=f"Refilled {qty} units of {product.product_name}. Previous: {prev_stock}, New: {product.current_stock}"
    ))

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save refill: {str(e)}")

    db.refresh(product)

    return {
        "success": True,
        "message": f"Successfully refilled {qty} {unit_str} of {product.product_name}!",
        "product": serialize_product(product),
        "purchase_id": purchase.id
    }


@router.get("/search")
def search_products(
    q: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop_id = getattr(current_user, "shop_id", 1) or 1
    query = db.query(Product).filter(
        Product.shop_id == shop_id,
        Product.is_active == True
    )
    search = f"%{q}%"
    query = query.filter(
        or_(
            Product.product_name.ilike(search),
            Product.product_code.ilike(search),
            Product.company_name.ilike(search),
            Product.barcode.ilike(search),
        )
    )
    products = query.limit(25).all()
    return [serialize_product(p) for p in products]


@router.get("")
def list_products(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    active_only: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop_id = getattr(current_user, "shop_id", 1) or 1
    query = db.query(Product).filter(Product.shop_id == shop_id)
    if active_only:
        query = query.filter(Product.is_active == True)
    if search:
        like = f"%{search}%"
        query = query.filter(
            or_(
                Product.product_name.ilike(like),
                Product.company_name.ilike(like),
                Product.barcode.ilike(like),
                Product.product_code.ilike(like)
            )
        )
    products = query.order_by(Product.product_name).offset(skip).limit(limit).all()
    return [serialize_product(p) for p in products]


@router.get("/{product_id}")
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop_id = getattr(current_user, "shop_id", 1) or 1
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.shop_id == shop_id
    ).first()
    if not product:
        raise HTTPException(404, "Product not found")
    return serialize_product(product)


@router.post("", status_code=201)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop_id = getattr(current_user, "shop_id", 1) or 1
    clean_name = payload.product_name.strip()
    clean_company = (payload.company_name or "").strip()

    # 1. Duplicate check: prevent duplicate product creation in same shop
    dup_query = db.query(Product).filter(
        Product.shop_id == shop_id,
        Product.is_active == True,
        func.lower(Product.product_name) == clean_name.lower()
    )
    if clean_company:
        dup_query = dup_query.filter(func.lower(Product.company_name) == clean_company.lower())
    existing = dup_query.first()

    if not existing and payload.barcode and payload.barcode.strip():
        existing = db.query(Product).filter(
            Product.shop_id == shop_id,
            Product.is_active == True,
            Product.barcode == payload.barcode.strip()
        ).first()

    if existing:
        unit_str = existing.unit.value if hasattr(existing.unit, "value") else str(existing.unit)
        raise HTTPException(
            status_code=409,
            detail={
                "message": f"Product '{existing.product_name}' by '{existing.company_name or 'N/A'}' already exists! Current Godown Stock: {existing.current_stock} {unit_str}. Please use 'Refill Stock' instead to manage stock under a single barcode.",
                "code": "PRODUCT_ALREADY_EXISTS",
                "existing_product": serialize_product(existing)
            }
        )

    # 2. Product code and Barcode generation scoped to shop
    code = payload.product_code or _generate_code(db, shop_id)
    while db.query(Product).filter(Product.shop_id == shop_id, Product.product_code == code).first():
        code = _generate_code(db, shop_id)

    barcode = payload.barcode.strip() if payload.barcode and payload.barcode.strip() else _generate_barcode(db, shop_id)

    # 3. Model creation
    valid_cols = {c.name for c in Product.__table__.columns}
    raw_dict = payload.model_dump()
    p_dict = {
        k: v for k, v in raw_dict.items()
        if k in valid_cols and k not in {"id", "created_at", "updated_at"}
    }
    p_dict["shop_id"] = shop_id
    p_dict["product_code"] = code
    p_dict["barcode"] = barcode
    if payload.hsn_code:
        p_dict["hsn_code"] = payload.hsn_code

    if "unit" in p_dict and p_dict["unit"] is not None:
        unit_raw = str(p_dict["unit"]).strip()
        matched_unit = None
        for ut in UnitType:
            if ut.value.lower() == unit_raw.lower() or ut.name.lower() == unit_raw.lower():
                matched_unit = ut
                break
        p_dict["unit"] = matched_unit or UnitType.BAGS

    product = Product(**p_dict)
    db.add(product)
    db.flush()

    # 4. Packaging variants creation (e.g. 250ml: Rs 500, 500ml: Rs 1000)
    unit_str = product.unit.value if hasattr(product.unit, "value") else str(product.unit or "Bags")
    if payload.variants and len(payload.variants) > 0:
        for idx, v_data in enumerate(payload.variants, 1):
            v_name = v_data.get("variant_name") or f"{v_data.get('unit_size', 1)} {v_data.get('unit', unit_str)}"
            v_barcode = v_data.get("barcode") or f"{barcode}-{idx}"
            var_obj = ProductVariant(
                product_id=product.id,
                variant_name=v_name,
                unit_size=Decimal(str(v_data.get("unit_size", product.net_content or 1))),
                unit=str(v_data.get("unit", unit_str)),
                purchase_price=Decimal(str(v_data.get("purchase_price", product.purchase_price or 0))),
                selling_price=Decimal(str(v_data.get("selling_price", product.selling_price or 0))),
                mrp=Decimal(str(v_data.get("mrp", product.selling_price or 0))),
                stock=Decimal(str(v_data.get("stock", product.current_stock or 0))),
                barcode=v_barcode
            )
            db.add(var_obj)
    else:
        # Default primary variant
        default_size = Decimal(str(product.net_content or 1))
        var_obj = ProductVariant(
            product_id=product.id,
            variant_name=f"{default_size:g} {unit_str}",
            unit_size=default_size,
            unit=unit_str,
            purchase_price=product.purchase_price or Decimal("0"),
            selling_price=product.selling_price,
            mrp=Decimal(str(payload.mrp)) if payload.mrp else product.selling_price,
            stock=product.current_stock or Decimal("0"),
            barcode=barcode
        )
        db.add(var_obj)

    # 5. Inventory transaction if starting stock > 0
    if product.current_stock and product.current_stock > 0:
        db.add(InventoryTransaction(
            shop_id=shop_id,
            product_id=product.id,
            transaction_type=InventoryTxType.PURCHASE,
            quantity=product.current_stock,
            previous_stock=Decimal("0"),
            new_stock=product.current_stock,
            reference_type="INITIAL",
            notes="Opening stock entry upon product creation"
        ))

    # 6. Create initial ProductBatch for tracking
    initial_selling = product.selling_price or Decimal("0")
    # ProductBatch.selling_price is NOT NULL — ensure a valid value
    if initial_selling <= Decimal("0"):
        initial_selling = product.purchase_price or Decimal("1")
    initial_batch = ProductBatch(
        product_id=product.id,
        batch_number=payload.batch_number or product.product_code or f"BAT-{product.id}",
        manufacture_date=product.manufacture_date,
        expiry_date=product.expiry_date or "2028-12",
        purchase_price=product.purchase_price or Decimal("0"),
        selling_price=initial_selling,
        mrp=Decimal(str(payload.mrp)) if payload.mrp else initial_selling,
        current_stock=product.current_stock or Decimal("0"),
        is_active=True
    )
    db.add(initial_batch)

    db.add(AuditLog(
        user_id=current_user.id, action=AuditAction.PRODUCT_CREATE,
        reference_id=product.id, reference_type="Product",
        description=f"Created product: {product.product_name} with barcode {barcode} for shop {shop_id}",
    ))
    db.commit()
    db.refresh(product)
    return serialize_product(product)


@router.put("/{product_id}")
def update_product(
    product_id: int,
    payload: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop_id = getattr(current_user, "shop_id", 1) or 1
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.shop_id == shop_id
    ).first()
    if not product:
        raise HTTPException(404, "Product not found")

    valid_cols = {c.name for c in Product.__table__.columns}
    update_data = {
        k: v for k, v in payload.model_dump(exclude_unset=True).items()
        if k in valid_cols and k not in {"id", "created_at", "updated_at", "shop_id"}
    }
    if "unit" in update_data and update_data["unit"] is not None:
        unit_raw = str(update_data["unit"]).strip()
        matched_unit = None
        for ut in UnitType:
            if ut.value.lower() == unit_raw.lower() or ut.name.lower() == unit_raw.lower():
                matched_unit = ut
                break
        update_data["unit"] = matched_unit or UnitType.BAGS

    for field, value in update_data.items():
        if field == "barcode" and value:
            other = db.query(Product).filter(
                Product.shop_id == shop_id,
                Product.barcode == value,
                Product.id != product.id
            ).first()
            if other:
                raise HTTPException(400, "This barcode is already assigned to another product in your shop")
        setattr(product, field, value)

    if payload.variants is not None:
        for old_v in product.variants:
            db.delete(old_v)
        unit_str = product.unit.value if hasattr(product.unit, "value") else str(product.unit or "Bags")
        for idx, v_data in enumerate(payload.variants, 1):
            v_name = v_data.get("variant_name") or f"{v_data.get('unit_size', 1)} {v_data.get('unit', unit_str)}"
            v_barcode = v_data.get("barcode") or f"{product.barcode or product.product_code}-{idx}"
            db.add(ProductVariant(
                product_id=product.id,
                variant_name=v_name,
                unit_size=Decimal(str(v_data.get("unit_size", product.net_content or 1))),
                unit=str(v_data.get("unit", unit_str)),
                purchase_price=Decimal(str(v_data.get("purchase_price", product.purchase_price or 0))),
                selling_price=Decimal(str(v_data.get("selling_price", product.selling_price or 0))),
                mrp=Decimal(str(v_data.get("mrp", product.selling_price or 0))),
                stock=Decimal(str(v_data.get("stock", product.current_stock or 0))),
                barcode=v_barcode
            ))

    product.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(product)

    db.add(AuditLog(
        user_id=current_user.id, action=AuditAction.PRODUCT_UPDATE,
        reference_id=product.id, reference_type="Product",
        description=f"Updated product: {product.product_name}",
    ))
    db.commit()
    return serialize_product(product)


@router.delete("/{product_id}", status_code=204)
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop_id = getattr(current_user, "shop_id", 1) or 1
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.shop_id == shop_id
    ).first()
    if not product:
        raise HTTPException(404, "Product not found")
    product.is_active = False
    db.commit()

    db.add(AuditLog(
        user_id=current_user.id, action=AuditAction.PRODUCT_DELETE,
        reference_id=product.id, reference_type="Product",
    ))
    db.commit()
