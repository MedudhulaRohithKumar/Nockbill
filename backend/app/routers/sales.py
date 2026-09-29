from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Optional
from decimal import Decimal
from datetime import datetime
from app.routers.products import serialize_product
from app.database.base import get_db
from app.models.models import (
    Sale, SaleItem, Product, ProductBatch, InventoryTransaction, InventoryTxType,
    GstTransaction, ShopSettings, AuditLog, AuditAction, User
)
from app.schemas.schemas import SaleCreate, SaleResponse, SaleListResponse
from app.utils.auth import get_current_user
from app.utils.helpers import generate_invoice_number

router = APIRouter(prefix="/api/sales", tags=["Sales"])


def _calculate_item(item_data, product: Optional[Product] = None):
    """Compute gst_amount and total for a sale item."""
    qty = Decimal(str(item_data.quantity))
    price = Decimal(str(item_data.price))
    gst_rate = Decimal(str(item_data.gst_rate))
    taxable = qty * price
    gst_amount = (taxable * gst_rate / 100).quantize(Decimal("0.01"))
    total = taxable + gst_amount
    return taxable, gst_amount, total


@router.post("", response_model=SaleResponse, status_code=201)
def create_sale(
    payload: SaleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop_id = getattr(current_user, "shop_id", 1) or 1

    # ── Idempotency check ──────────────────────────────────────
    if payload.idempotency_key:
        existing = db.query(Sale).filter(
            Sale.shop_id == shop_id,
            Sale.idempotency_key == payload.idempotency_key
        ).first()
        if existing:
            return existing  # replay-safe response

    # ── Validate stock before transaction ──────────────────────
    for item in payload.items:
        if item.product_id:
            product = db.query(Product).filter(
                Product.id == item.product_id,
                Product.shop_id == shop_id
            ).first()
            if product and product.current_stock < Decimal(str(item.quantity)):
                raise HTTPException(
                    400,
                    f"Insufficient stock for '{product.product_name}'. "
                    f"Available: {product.current_stock}",
                )

    # ── Get / create shop settings ─────────────────────────────
    shop = db.query(ShopSettings).filter(ShopSettings.id == shop_id).first()
    if not shop:
        shop = ShopSettings(shop_name=f"{current_user.name}'s Shop", invoice_counter=1)
        db.add(shop)
        db.flush()
        current_user.shop_id = shop.id

    # ── Generate guaranteed unique invoice number for this shop ─
    sale_date = datetime.utcnow()
    while True:
        invoice_number = generate_invoice_number(
            shop.invoice_prefix, shop.invoice_counter, sale_date
        )
        shop.invoice_counter += 1
        existing_sale = db.query(Sale).filter(
            Sale.shop_id == shop_id,
            Sale.invoice_number == invoice_number
        ).first()
        if not existing_sale:
            break

    # ── Create Sale (all-or-nothing transaction) ───────────────
    try:
        subtotal = Decimal("0")
        total_gst = Decimal("0")
        grand_total = Decimal("0")

        notes = payload.notes
        if not notes and payload.payment_details:
            try:
                import json
                splits = json.loads(payload.payment_details)
                if isinstance(splits, list) and len(splits) > 1:
                    notes = "Split Payment: " + " | ".join(f"{s.get('method')}: ₹{s.get('amount')}" for s in splits)
                elif isinstance(splits, list) and len(splits) == 1:
                    notes = f"Payment: {splits[0].get('method')}"
            except Exception:
                notes = payload.payment_details

        sale = Sale(
            shop_id=shop_id,
            invoice_number=invoice_number,
            idempotency_key=payload.idempotency_key,
            customer_name=payload.customer_name,
            customer_phone=payload.customer_phone,
            payment_method=payload.payment_method,
            notes=notes,
            sale_date=sale_date,
            created_by=current_user.id,
        )
        db.add(sale)
        db.flush()  # get sale.id

        gst_buckets: dict[Decimal, dict] = {}  # gst_rate -> {taxable, gst}

        for item_data in payload.items:
            taxable, gst_amount, total = _calculate_item(item_data)
            subtotal += taxable
            total_gst += gst_amount
            grand_total += total

            sale_item = SaleItem(
                sale_id=sale.id,
                product_id=item_data.product_id,
                batch_id=item_data.batch_id,
                batch_number=item_data.batch_number,
                product_name=item_data.product_name,
                company_name=item_data.company_name,
                net_content=item_data.net_content,
                quantity=item_data.quantity,
                price=item_data.price,
                gst_rate=item_data.gst_rate,
                gst_amount=gst_amount,
                total=total,
                manufacture_date=item_data.manufacture_date,
                expiry_date=item_data.expiry_date,
            )
            db.add(sale_item)

            # Accumulate GST by rate
            rate = Decimal(str(item_data.gst_rate))
            if rate not in gst_buckets:
                gst_buckets[rate] = {"taxable": Decimal("0"), "gst": Decimal("0")}
            gst_buckets[rate]["taxable"] += taxable
            gst_buckets[rate]["gst"] += gst_amount

            # ── Update inventory ────────────────────────────────
            if item_data.product_id:
                product = db.query(Product).filter(
                    Product.id == item_data.product_id
                ).with_for_update().first()
                if product:
                    prev_stock = product.current_stock or Decimal("0")
                    qty_to_deduct = Decimal(str(item_data.quantity))
                    product.current_stock = max(Decimal("0"), prev_stock - qty_to_deduct)

                    # Deduct from specific ProductBatch if identified
                    batch = None
                    if item_data.batch_id:
                        batch = db.query(ProductBatch).filter(ProductBatch.id == item_data.batch_id).with_for_update().first()
                    elif item_data.batch_number:
                        batch = db.query(ProductBatch).filter(
                            ProductBatch.product_id == product.id,
                            ProductBatch.batch_number == item_data.batch_number
                        ).with_for_update().first()

                    if batch:
                        batch.current_stock = max(Decimal("0"), (batch.current_stock or Decimal("0")) - qty_to_deduct)
                    else:
                        # FIFO deduction across active batches
                        rem = qty_to_deduct
                        active_b = db.query(ProductBatch).filter(
                            ProductBatch.product_id == product.id,
                            ProductBatch.is_active == True,
                            ProductBatch.current_stock > 0
                        ).order_by(ProductBatch.expiry_date.asc()).with_for_update().all()
                        for b in active_b:
                            if rem <= 0:
                                break
                            ded = min(b.current_stock, rem)
                            b.current_stock -= ded
                            rem -= ded

                    inv_tx = InventoryTransaction(
                        shop_id=shop_id,
                        product_id=product.id,
                        transaction_type=InventoryTxType.SALE,
                        quantity=item_data.quantity,
                        previous_stock=prev_stock,
                        new_stock=product.current_stock,
                        reference_id=sale.id,
                        reference_type="SALE",
                        notes=f"Sold {item_data.quantity} units (Batch: {item_data.batch_number or 'DEFAULT'})",
                    )
                    db.add(inv_tx)

        # ── Update sale totals ─────────────────────────────────
        sale.subtotal = subtotal.quantize(Decimal("0.01"))
        sale.gst_amount = total_gst.quantize(Decimal("0.01"))
        sale.grand_total = grand_total.quantize(Decimal("0.01"))

        # ── Create GST transactions ────────────────────────────
        for rate, bucket in gst_buckets.items():
            gst_tx = GstTransaction(
                shop_id=shop_id,
                sale_id=sale.id,
                invoice_number=invoice_number,
                taxable_amount=bucket["taxable"].quantize(Decimal("0.01")),
                gst_rate=rate,
                gst_amount=bucket["gst"].quantize(Decimal("0.01")),
                transaction_date=sale_date,
            )
            db.add(gst_tx)

        # ── Audit log ──────────────────────────────────────────
        db.add(AuditLog(
            user_id=current_user.id,
            action=AuditAction.SALE_CREATE,
            reference_id=sale.id,
            reference_type="Sale",
            description=f"Invoice {invoice_number}, Total ₹{sale.grand_total}",
        ))

        db.commit()
        db.refresh(sale)
        return serialize_sale(sale)

    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Failed to save bill: {str(e)}")


def serialize_sale(s: Sale) -> dict:
    sub = float(s.subtotal or 0)
    gst = float(s.gst_amount or 0)
    half_gst = round(gst / 2.0, 2)
    s_date = s.sale_date.isoformat() if s.sale_date else datetime.utcnow().isoformat()
    p_mode = s.payment_method.value if hasattr(s.payment_method, "value") else str(s.payment_method or "Cash")
    return {
        "id": s.id,
        "invoice_number": s.invoice_number,
        "customer_name": s.customer_name or "Cash Customer / Farmer",
        "customer_phone": s.customer_phone or "",
        "payment_method": p_mode,
        "payment_mode": p_mode,
        "sale_date": s_date,
        "invoice_date": s_date,
        "subtotal": sub,
        "gst_amount": gst,
        "total_taxable": sub,
        "total_cgst": half_gst,
        "total_sgst": half_gst,
        "total_igst": 0.0,
        "round_off": 0.0,
        "grand_total": float(s.grand_total or 0),
        "notes": s.notes or "",
        "status": "Completed",
        "items": [
            {
                "id": it.id,
                "product_id": it.product_id,
                "batch_id": it.batch_id,
                "batch_number": it.batch_number,
                "expiry_date": it.expiry_date,
                "product_name": it.product_name,
                "company_name": it.company_name,
                "quantity": float(it.quantity or 0),
                "price": float(it.price or 0),
                "unit_price": float(it.price or 0),
                "gst_rate": float(it.gst_rate or 0),
                "gst_amount": float(it.gst_amount or 0),
                "taxable_amount": float(it.total or 0) - float(it.gst_amount or 0),
                "total_amount": float(it.total or 0),
                "total": float(it.total or 0),
            }
            for it in (s.items or [])
        ]
    }


@router.get("")
def list_sales(
    skip: int = 0,
    limit: int = 200,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop_id = getattr(current_user, "shop_id", 1) or 1
    query = db.query(Sale).filter(Sale.shop_id == shop_id)
    if start_date:
        try:
            from datetime import date as date_type
            sd = datetime.strptime(start_date, "%Y-%m-%d")
            query = query.filter(Sale.sale_date >= sd)
        except Exception:
            pass
    if end_date:
        try:
            ed = datetime.strptime(end_date, "%Y-%m-%d")
            # Include the full end day
            ed = ed.replace(hour=23, minute=59, second=59)
            query = query.filter(Sale.sale_date <= ed)
        except Exception:
            pass
    sales = query.order_by(Sale.sale_date.desc()).offset(skip).limit(limit).all()
    return [serialize_sale(s) for s in sales]


@router.get("/frequently-sold")
def get_frequently_sold(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return top most frequently billed products with their variants for 1-click billing."""
    shop_id = getattr(current_user, "shop_id", 1) or 1
    popular = (
        db.query(
            SaleItem.product_id,
            func.count(SaleItem.id).label("bill_count"),
            func.sum(SaleItem.quantity).label("total_qty")
        )
        .join(Sale, Sale.id == SaleItem.sale_id)
        .filter(Sale.shop_id == shop_id, SaleItem.product_id != None)
        .group_by(SaleItem.product_id)
        .order_by(desc("bill_count"))
        .limit(limit)
        .all()
    )

    prod_ids = [p.product_id for p in popular if p.product_id]
    products = db.query(Product).filter(
        Product.id.in_(prod_ids),
        Product.shop_id == shop_id,
        Product.is_active == True
    ).all() if prod_ids else []
    prod_map = {p.id: p for p in products}

    results = []
    for item in popular:
        if item.product_id in prod_map:
            p = prod_map[item.product_id]
            data = serialize_product(p)
            data["bill_count"] = int(item.bill_count)
            data["total_qty_sold"] = float(item.total_qty or 0)
            results.append(data)

    if len(results) < 8:
        existing_ids = {r["id"] for r in results}
        extras = (
            db.query(Product)
            .filter(
                Product.shop_id == shop_id,
                Product.is_active == True,
                Product.current_stock > 0,
                ~Product.id.in_(existing_ids)
            )
            .limit(8 - len(results))
            .all()
        )
        for p in extras:
            data = serialize_product(p)
            data["bill_count"] = 0
            results.append(data)

    return results


@router.get("/{sale_id}")
def get_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop_id = getattr(current_user, "shop_id", 1) or 1
    sale = db.query(Sale).filter(Sale.id == sale_id, Sale.shop_id == shop_id).first()
    if not sale:
        raise HTTPException(404, "Sale not found")
    return serialize_sale(sale)
