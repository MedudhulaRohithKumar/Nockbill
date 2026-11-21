import json
import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.database.base import get_db
from app.models.models import (
    AuditAction,
    AuditLog,
    GstTransaction,
    InventoryTransaction,
    InventoryTxType,
    Product,
    ProductBatch,
    Sale,
    SaleItem,
    ShopSettings,
    User,
)
from app.routers.products import serialize_product
from app.schemas.schemas import SaleCreate, SaleResponse
from app.utils.auth import get_current_user, is_owner
from app.utils.errors import internal_server_error
from app.utils.helpers import generate_invoice_number, resolve_trade_name
from app.utils.stock_sync import sync_variant_stock

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/sales", tags=["Sales"])

_PRICE_TOLERANCE = Decimal("0.01")


def _calculate_item(
    item_data,
    effective_price: Optional[Decimal] = None,
    effective_gst_rate: Optional[Decimal] = None,
    allow_discount: bool = True,
) -> Tuple[Decimal, Decimal, Decimal, Decimal, Decimal]:
    """
    Compute taxable, gst_amount, total, discount_percent, and discount_amount for a sale item.
    Retail selling prices are TAX-INCLUSIVE: GST is extracted from the final
    tax-inclusive total for ledgering and is NOT added on top.
    """
    qty = Decimal(str(item_data.quantity))
    raw_price = (
        effective_price
        if effective_price is not None
        else (
            item_data.price
            if item_data.price is not None
            else (getattr(item_data, "unit_price", None) or Decimal("0"))
        )
    )
    price = Decimal(str(raw_price))
    gst_rate = Decimal(
        str(effective_gst_rate if effective_gst_rate is not None else (item_data.gst_rate or 0))
    )

    gross = (qty * price).quantize(Decimal("0.01"))
    discount_pct = Decimal("0.00")
    discount_amt = Decimal("0.00")
    if allow_discount:
        discount_pct = Decimal(str(getattr(item_data, "discount_percent", 0) or 0))
        if discount_pct > Decimal("0"):
            discount_amt = (gross * discount_pct / Decimal("100")).quantize(Decimal("0.01"))
        else:
            discount_amt = max(
                Decimal("0.00"),
                Decimal(str(getattr(item_data, "discount_amount", 0) or 0)).quantize(Decimal("0.01")),
            )

    discount_amt = min(discount_amt, gross)
    total = max(Decimal("0.00"), gross - discount_amt)

    if gst_rate > Decimal("0"):
        divisor = Decimal("1") + (gst_rate / Decimal("100"))
        taxable = (total / divisor).quantize(Decimal("0.01"))
        gst_amount = total - taxable
    else:
        taxable = total
        gst_amount = Decimal("0.00")

    return taxable, gst_amount, total, discount_pct, discount_amt


def _match_batch(
    item_data,
    product: Optional[Product],
    batches_by_id: Dict[int, ProductBatch],
    batches_by_product: Dict[int, List[ProductBatch]],
) -> Optional[ProductBatch]:
    if not product:
        return None
    if item_data.batch_id and item_data.batch_id in batches_by_id:
        candidate = batches_by_id[item_data.batch_id]
        if candidate.product_id == product.id:
            return candidate
    if item_data.batch_number:
        return next(
            (b for b in batches_by_product.get(product.id, []) if b.batch_number == item_data.batch_number),
            None,
        )
    return None


def _resolve_authoritative_pricing(
    item_data,
    product: Optional[Product],
    batch: Optional[ProductBatch],
    caller_is_owner: bool,
) -> Tuple[Decimal, Decimal, Decimal, Optional[str]]:
    """
    Derive authoritative selling price, GST rate, and snapshot cost_price from the DB (C5/B6).
    - STAFF users cannot override unit price, GST rate, apply manual discounts, or bill ad-hoc items.
    - OWNER users may override price/discount/GST; every override is returned for AuditLog recording.
    """
    submitted_price_raw = (
        item_data.price
        if item_data.price is not None
        else getattr(item_data, "unit_price", None)
    )
    submitted_price = Decimal(str(submitted_price_raw)) if submitted_price_raw is not None else None
    submitted_gst = Decimal(str(item_data.gst_rate)) if item_data.gst_rate is not None else None
    discount_pct = Decimal(str(getattr(item_data, "discount_percent", 0) or 0))
    discount_amt = Decimal(str(getattr(item_data, "discount_amount", 0) or 0))
    has_discount = discount_pct > Decimal("0") or discount_amt > Decimal("0")

    if product is None:
        if item_data.product_id is not None:
            raise HTTPException(404, f"Product ID {item_data.product_id} not found in your shop")
        if not caller_is_owner:
            raise HTTPException(
                403,
                "Only shop owners can bill custom non-catalog items.",
            )
        final_price = max(Decimal("0.00"), submitted_price or Decimal("0.00"))
        final_gst = max(Decimal("0.00"), submitted_gst or Decimal("0.00"))
        return final_price, final_gst, Decimal("0.00"), f"Custom item '{item_data.product_name}' at ₹{final_price}"

    db_gst = Decimal(str(product.gst_rate or 0))
    db_default_price = (
        Decimal(str(batch.selling_price))
        if (batch and batch.selling_price is not None and batch.selling_price > 0)
        else Decimal(str(product.selling_price or 0))
    )
    allowed_prices = {db_default_price, Decimal(str(product.selling_price or 0))}
    for v in (product.variants or []):
        if getattr(v, "is_active", True) and v.selling_price is not None:
            allowed_prices.add(Decimal(str(v.selling_price)))

    effective_cost = (
        Decimal(str(batch.purchase_price))
        if (batch and batch.purchase_price is not None and batch.purchase_price > 0)
        else Decimal(str(product.purchase_price or 0))
    )

    matched_db_price: Optional[Decimal] = None
    if submitted_price is not None:
        matched_db_price = next(
            (ap for ap in allowed_prices if abs(submitted_price - ap) <= _PRICE_TOLERANCE),
            None,
        )

    price_overridden = submitted_price is not None and matched_db_price is None
    gst_overridden = submitted_gst is not None and abs(submitted_gst - db_gst) > _PRICE_TOLERANCE

    if not caller_is_owner:
        if price_overridden or gst_overridden or has_discount:
            raise HTTPException(
                403,
                "Only shop owners can override unit prices, GST rates, or apply manual discounts.",
            )
        return (matched_db_price if matched_db_price is not None else db_default_price), db_gst, effective_cost, None

    final_price = submitted_price if submitted_price is not None else db_default_price
    if final_price < Decimal("0"):
        raise HTTPException(400, "Unit price cannot be negative")
    final_gst = submitted_gst if submitted_gst is not None else db_gst

    override_note = None
    if price_overridden or gst_overridden or has_discount:
        override_note = (
            f"Override on '{product.product_name}': price ₹{db_default_price}->₹{final_price}, "
            f"gst {db_gst}%->{final_gst}%, disc={discount_pct}%/₹{discount_amt}"
        )
    return final_price, final_gst, effective_cost, override_note


def _format_sale_notes(payload: SaleCreate) -> Optional[str]:
    notes = payload.notes
    if notes or not payload.payment_details:
        return notes
    try:
        splits = json.loads(payload.payment_details)
        if isinstance(splits, list) and len(splits) > 1:
            return "Split Payment: " + " | ".join(
                f"{s.get('method')}: ₹{s.get('amount')}" for s in splits
            )
        if isinstance(splits, list) and len(splits) == 1:
            return f"Payment: {splits[0].get('method')}"
    except Exception:
        return payload.payment_details
    return notes


def _allocate_invoice_number(
    db: Session,
    shop_id: int,
    current_user: User,
    sale_date: datetime,
) -> str:
    """Acquire ShopSettings counter lock at the last possible moment to minimize POS lock contention (B8)."""
    shop = db.query(ShopSettings).filter(ShopSettings.id == shop_id).with_for_update().first()
    if not shop:
        shop = ShopSettings(shop_name=f"{current_user.name}'s Shop", invoice_counter=1)
        db.add(shop)
        db.flush()
        current_user.shop_id = shop.id

    while True:
        invoice_number = generate_invoice_number(
            shop.invoice_prefix, shop.invoice_counter, sale_date
        )
        shop.invoice_counter += 1
        existing_sale = db.query(Sale.id).filter(
            Sale.shop_id == shop_id,
            Sale.invoice_number == invoice_number,
        ).first()
        if not existing_sale:
            return invoice_number


@router.post("", response_model=SaleResponse, status_code=201)
def create_sale(
    payload: SaleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop_id = getattr(current_user, "shop_id", 1) or 1
    caller_is_owner = is_owner(current_user)

    # ── Idempotency check ──────────────────────────────────────
    if payload.idempotency_key:
        existing = db.query(Sale).options(selectinload(Sale.items)).filter(
            Sale.shop_id == shop_id,
            Sale.idempotency_key == payload.idempotency_key,
        ).first()
        if existing:
            return serialize_sale(existing)

    # ── Deadlock-Free Pre-Locking (Sorted by ID ASC) ───────────
    product_ids = sorted({item.product_id for item in payload.items if item.product_id})
    locked_products = (
        db.query(Product)
        .options(selectinload(Product.variants))
        .filter(Product.shop_id == shop_id, Product.id.in_(product_ids))
        .order_by(Product.id.asc())
        .with_for_update()
        .all()
    ) if product_ids else []
    products_by_id = {p.id: p for p in locked_products}

    # Verify every requested product_id belongs to this shop and has sufficient stock
    required_qty_by_product: Dict[int, Decimal] = {}
    for item in payload.items:
        if item.product_id:
            if item.product_id not in products_by_id:
                raise HTTPException(404, f"Product ID {item.product_id} not found in your shop")
            required_qty_by_product[item.product_id] = (
                required_qty_by_product.get(item.product_id, Decimal("0")) + Decimal(str(item.quantity))
            )

    for pid, total_req_qty in required_qty_by_product.items():
        product = products_by_id[pid]
        if (product.current_stock or Decimal("0")) < total_req_qty:
            raise HTTPException(
                400,
                f"Insufficient stock for '{product.product_name}'. "
                f"Available: {product.current_stock}, Requested: {total_req_qty}",
            )

    # Pre-lock all active ProductBatch rows in deterministic order
    locked_batches = (
        db.query(ProductBatch)
        .filter(ProductBatch.product_id.in_(product_ids), ProductBatch.is_active == True)
        .order_by(ProductBatch.product_id.asc(), ProductBatch.expiry_date.asc(), ProductBatch.id.asc())
        .with_for_update()
        .all()
    ) if product_ids else []
    batches_by_product: Dict[int, List[ProductBatch]] = {}
    batches_by_id: Dict[int, ProductBatch] = {}
    for b in locked_batches:
        batches_by_product.setdefault(b.product_id, []).append(b)
        batches_by_id[b.id] = b

    # Resolve & validate authoritative prices/taxes BEFORE acquiring ShopSettings counter lock (C5 + B8)
    prepared_lines = []
    override_notes: List[str] = []
    subtotal = Decimal("0")
    total_gst = Decimal("0")
    total_discount = Decimal("0")
    grand_total = Decimal("0")
    gst_buckets: Dict[Decimal, Dict[str, Decimal]] = {}

    for item_data in payload.items:
        product = products_by_id.get(item_data.product_id) if item_data.product_id else None
        batch = _match_batch(item_data, product, batches_by_id, batches_by_product)
        eff_price, eff_gst, eff_cost, override_note = _resolve_authoritative_pricing(
            item_data, product, batch, caller_is_owner
        )
        if override_note:
            override_notes.append(override_note)

        taxable, gst_amount, total, disc_pct, disc_amt = _calculate_item(
            item_data,
            effective_price=eff_price,
            effective_gst_rate=eff_gst,
            allow_discount=caller_is_owner,
        )
        subtotal += taxable
        total_gst += gst_amount
        total_discount += disc_amt
        grand_total += total

        if eff_gst not in gst_buckets:
            gst_buckets[eff_gst] = {"taxable": Decimal("0"), "gst": Decimal("0")}
        gst_buckets[eff_gst]["taxable"] += taxable
        gst_buckets[eff_gst]["gst"] += gst_amount

        prepared_lines.append((item_data, product, batch, eff_price, eff_gst, eff_cost, gst_amount, total, disc_pct, disc_amt))

    # ── Persist Sale atomically; lock ShopSettings counter only right before insert (B8) ──
    try:
        sale_date = datetime.now(timezone.utc)
        invoice_number = _allocate_invoice_number(db, shop_id, current_user, sale_date)
        is_interstate = bool(payload.is_interstate)
        gst_quant = total_gst.quantize(Decimal("0.01"))
        computed_grand = grand_total.quantize(Decimal("0.01"))

        sale = Sale(
            shop_id=shop_id,
            invoice_number=invoice_number,
            idempotency_key=payload.idempotency_key,
            customer_name=payload.customer_name,
            customer_phone=payload.customer_phone,
            customer_address=payload.customer_address,
            customer_aadhar=(payload.customer_aadhar or "").strip()[:20] or None,
            customer_gstin=payload.customer_gstin,
            is_interstate=is_interstate,
            subtotal=subtotal.quantize(Decimal("0.01")),
            total_discount=total_discount.quantize(Decimal("0.01")),
            gst_amount=gst_quant,
            total_igst=gst_quant if is_interstate else Decimal("0.00"),
            round_off=Decimal("0.00"),
            grand_total=computed_grand,
            payment_method=payload.payment_method,
            vehicle_no=payload.vehicle_no,
            eway_bill_no=payload.eway_bill_no,
            eway_bill_date=datetime.now(timezone.utc) if payload.eway_bill_no else None,
            notes=_format_sale_notes(payload),
            sale_date=sale_date,
            created_by=current_user.id,
        )
        db.add(sale)
        db.flush()

        for item_data, product, batch, eff_price, eff_gst, eff_cost, gst_amount, total, disc_pct, disc_amt in prepared_lines:
            effective_company = item_data.company_name or (product.company_name if product else None)
            effective_trade = (
                item_data.trade_name
                or (product.trade_name if product else None)
                or resolve_trade_name(item_data.product_name, effective_company)
            )
            effective_hsn = (product.hsn_code if product and product.hsn_code else None) or item_data.hsn_code
            effective_unit = (
                (product.unit.value if hasattr(product.unit, "value") else str(product.unit))
                if product and product.unit
                else (item_data.unit or "Bags")
            )
            effective_mrp = (
                batch.mrp if (batch and batch.mrp is not None)
                else (item_data.mrp if item_data.mrp is not None else eff_price)
            )
            sale_item = SaleItem(
                sale_id=sale.id,
                product_id=item_data.product_id,
                batch_id=batch.id if batch else item_data.batch_id,
                batch_number=batch.batch_number if batch else item_data.batch_number,
                product_name=product.product_name if product else item_data.product_name,
                company_name=effective_company,
                trade_name=effective_trade,
                hsn_code=effective_hsn,
                unit=effective_unit,
                net_content=item_data.net_content,
                quantity=item_data.quantity,
                price=eff_price,
                mrp=effective_mrp,
                discount_percent=disc_pct,
                discount_amount=disc_amt,
                cost_price=eff_cost,
                gst_rate=eff_gst,
                gst_amount=gst_amount,
                total=total,
                manufacture_date=item_data.manufacture_date,
                expiry_date=item_data.expiry_date,
            )
            db.add(sale_item)

            if product:
                prev_stock = product.current_stock or Decimal("0")
                qty_to_deduct = Decimal(str(item_data.quantity))
                product.current_stock = max(Decimal("0"), prev_stock - qty_to_deduct)

                if batch:
                    batch.current_stock = max(Decimal("0"), (batch.current_stock or Decimal("0")) - qty_to_deduct)
                else:
                    rem = qty_to_deduct
                    for b in batches_by_product.get(product.id, []):
                        if rem <= 0:
                            break
                        avail = b.current_stock or Decimal("0")
                        if avail > 0:
                            ded = min(avail, rem)
                            b.current_stock = avail - ded
                            rem -= ded

                # Synchronize ProductVariant.stock with Product/Batch deductions (SD3)
                sync_variant_stock(db, product, -qty_to_deduct, matched_price=eff_price)

                db.add(InventoryTransaction(
                    shop_id=shop_id,
                    product_id=product.id,
                    transaction_type=InventoryTxType.SALE,
                    quantity=item_data.quantity,
                    previous_stock=prev_stock,
                    new_stock=product.current_stock,
                    reference_id=sale.id,
                    reference_type="SALE",
                    notes=f"Sold {item_data.quantity} units (Batch: {item_data.batch_number or 'DEFAULT'})",
                ))

        for rate, bucket in gst_buckets.items():
            db.add(GstTransaction(
                shop_id=shop_id,
                sale_id=sale.id,
                invoice_number=invoice_number,
                taxable_amount=bucket["taxable"].quantize(Decimal("0.01")),
                gst_rate=rate,
                gst_amount=bucket["gst"].quantize(Decimal("0.01")),
                transaction_date=sale_date,
            ))

        audit_desc = f"Invoice {invoice_number}, Total ₹{sale.grand_total}"
        if override_notes:
            audit_desc += " | " + "; ".join(override_notes)
        db.add(AuditLog(
            shop_id=shop_id,
            user_id=current_user.id,
            action=AuditAction.SALE_CREATE,
            reference_id=sale.id,
            reference_type="Sale",
            description=audit_desc,
        ))

        db.commit()
        db.refresh(sale)
        return serialize_sale(sale)

    except HTTPException:
        db.rollback()
        raise
    except IntegrityError:
        db.rollback()
        if payload.idempotency_key:
            existing = (
                db.query(Sale)
                .options(selectinload(Sale.items))
                .filter(
                    Sale.shop_id == shop_id,
                    Sale.idempotency_key == payload.idempotency_key,
                )
                .first()
            )
            if existing:
                return serialize_sale(existing)
        raise internal_server_error(logger, "Failed to save bill due to a conflict")
    except Exception:
        db.rollback()
        raise internal_server_error(logger, "Failed to save bill")


def serialize_sale(s: Sale) -> dict:
    sub = float(s.subtotal or 0)
    gst = float(s.gst_amount or 0)
    interstate = bool(getattr(s, "is_interstate", False))
    igst = float(getattr(s, "total_igst", None) or (gst if interstate else 0.0))
    half_gst = 0.0 if interstate else round(gst / 2.0, 2)
    s_date = s.sale_date.isoformat() if s.sale_date else datetime.now(timezone.utc).isoformat()
    p_mode = s.payment_method.value if hasattr(s.payment_method, "value") else str(s.payment_method or "Cash")
    return {
        "id": s.id,
        "invoice_number": s.invoice_number,
        "customer_name": s.customer_name or "Cash Customer / Farmer",
        "customer_phone": s.customer_phone or "",
        "customer_address": getattr(s, "customer_address", None) or "",
        "customer_aadhar": getattr(s, "customer_aadhar", None) or "",
        "customer_gstin": getattr(s, "customer_gstin", None) or "",
        "is_interstate": interstate,
        "payment_method": p_mode,
        "payment_mode": p_mode,
        "sale_date": s_date,
        "invoice_date": s_date,
        "subtotal": sub,
        "total_discount": float(getattr(s, "total_discount", 0) or 0),
        "gst_amount": gst,
        "total_taxable": sub,
        "total_cgst": half_gst,
        "total_sgst": half_gst,
        "total_igst": igst,
        "round_off": float(getattr(s, "round_off", 0) or 0),
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
                "trade_name": getattr(it, "trade_name", None) or resolve_trade_name(it.product_name, it.company_name),
                "hsn_code": getattr(it, "hsn_code", None) or "",
                "unit": getattr(it, "unit", None) or "Bags",
                "quantity": float(it.quantity or 0),
                "price": float(it.price or 0),
                "unit_price": float(it.price or 0),
                "mrp": float(getattr(it, "mrp", None) or it.price or 0),
                "discount_percent": float(getattr(it, "discount_percent", 0) or 0),
                "discount_amount": float(getattr(it, "discount_amount", 0) or 0),
                "cost_price": float(it.cost_price) if it.cost_price is not None else None,
                "gst_rate": float(it.gst_rate or 0),
                "gst_amount": float(it.gst_amount or 0),
                "taxable_amount": float(it.total or 0) - float(it.gst_amount or 0),
                "total_amount": float(it.total or 0),
                "total": float(it.total or 0),
            }
            for it in (s.items or [])
        ],
    }


@router.get("")
def list_sales(
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=500),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop_id = getattr(current_user, "shop_id", 1) or 1
    query = db.query(Sale).options(selectinload(Sale.items)).filter(Sale.shop_id == shop_id)
    if start_date:
        try:
            sd = datetime.strptime(start_date, "%Y-%m-%d")
            query = query.filter(Sale.sale_date >= sd)
        except Exception:
            pass
    if end_date:
        try:
            ed = datetime.strptime(end_date, "%Y-%m-%d")
            ed = ed.replace(hour=23, minute=59, second=59)
            query = query.filter(Sale.sale_date <= ed)
        except Exception:
            pass
    sales = query.order_by(Sale.sale_date.desc()).offset(skip).limit(limit).all()
    return [serialize_sale(s) for s in sales]


@router.get("/frequently-sold")
def get_frequently_sold(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return top most frequently billed products with their variants for 1-click billing."""
    shop_id = getattr(current_user, "shop_id", 1) or 1
    popular = (
        db.query(
            SaleItem.product_id,
            func.count(SaleItem.id).label("bill_count"),
            func.sum(SaleItem.quantity).label("total_qty"),
        )
        .join(Sale, Sale.id == SaleItem.sale_id)
        .filter(Sale.shop_id == shop_id, SaleItem.product_id.isnot(None))
        .group_by(SaleItem.product_id)
        .order_by(desc("bill_count"))
        .limit(limit)
        .all()
    )

    prod_ids = [p.product_id for p in popular if p.product_id]
    products = db.query(Product).options(
        selectinload(Product.variants),
        selectinload(Product.batches),
    ).filter(
        Product.id.in_(prod_ids),
        Product.shop_id == shop_id,
        Product.is_active == True,
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
            .options(
                selectinload(Product.variants),
                selectinload(Product.batches),
            )
            .filter(
                Product.shop_id == shop_id,
                Product.is_active == True,
                Product.current_stock > 0,
                ~Product.id.in_(existing_ids),
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
    sale = db.query(Sale).options(selectinload(Sale.items)).filter(
        Sale.id == sale_id,
        Sale.shop_id == shop_id,
    ).first()
    if not sale:
        raise HTTPException(404, "Sale not found")
    return serialize_sale(sale)
