from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import func, desc
from typing import List, Optional
from decimal import Decimal
from datetime import datetime

from app.database.base import get_db
from app.models.models import (
    Sale, SaleItem, SalesReturn, SalesReturnItem, Product, ProductBatch,
    InventoryTransaction, InventoryTxType, ShopSettings, AuditLog, AuditAction, User, PaymentMethod
)
from app.schemas.schemas import (
    SalesReturnCreate, SalesReturnResponse, InvoiceReturnLookupResponse,
    ReturnEligibleItem, SalesReturnItemResponse
)
from app.utils.auth import get_current_user
from app.reports.return_pdf import generate_sales_return_pdf

router = APIRouter(prefix="/api/returns", tags=["Sales Returns"])


def _generate_return_number(db: Session, return_date: datetime, shop_id: int = 1) -> str:
    """Generate a unique return number: RET-YYYYMM-XXXXX."""
    prefix = f"RET-{return_date.strftime('%Y%m')}"
    # Count returns in this month for this shop
    start_of_month = datetime(return_date.year, return_date.month, 1)
    if return_date.month == 12:
        end_of_month = datetime(return_date.year + 1, 1, 1)
    else:
        end_of_month = datetime(return_date.year, return_date.month + 1, 1)

    count = db.query(func.count(SalesReturn.id)).filter(
        SalesReturn.shop_id == shop_id,
        SalesReturn.return_date >= start_of_month,
        SalesReturn.return_date < end_of_month
    ).scalar() or 0

    counter = count + 1
    while True:
        ret_num = f"{prefix}-{counter:05d}"
        exists = db.query(SalesReturn).filter(
            SalesReturn.shop_id == shop_id,
            SalesReturn.return_number == ret_num
        ).first()
        if not exists:
            return ret_num
        counter += 1


@router.get("/lookup", response_model=InvoiceReturnLookupResponse)
def lookup_invoice_for_return(
    invoice_number: str = Query(..., description="Invoice number to look up"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Look up an invoice by invoice_number and determine return-eligible items
    with remaining quantities.
    """
    clean_inv = invoice_number.strip()
    if not clean_inv:
        raise HTTPException(status_code=400, detail="Please enter an invoice number")

    shop_id = getattr(current_user, "shop_id", 1) or 1

    # Search for sale (exact or case-insensitive) within this shop
    sale = db.query(Sale).options(selectinload(Sale.items)).filter(
        Sale.shop_id == shop_id,
        func.lower(Sale.invoice_number) == clean_inv.lower()
    ).first()

    if not sale:
        # Also try searching by invoice ID if numeric
        if clean_inv.isdigit():
            sale = db.query(Sale).options(selectinload(Sale.items)).filter(
                Sale.id == int(clean_inv),
                Sale.shop_id == shop_id
            ).first()

    if not sale:
        raise HTTPException(
            status_code=404,
            detail=f"No bill found matching invoice number '{clean_inv}'"
        )

    # Get all previous returns for this sale
    existing_returns = db.query(SalesReturn).options(selectinload(SalesReturn.items)).filter(
        SalesReturn.sale_id == sale.id,
        SalesReturn.shop_id == shop_id
    ).all()
    
    # Calculate previously returned quantities per sale_item_id
    returned_totals: dict[int, Decimal] = {}
    for ret in existing_returns:
        for ret_item in ret.items:
            if ret_item.sale_item_id:
                returned_totals[ret_item.sale_item_id] = (
                    returned_totals.get(ret_item.sale_item_id, Decimal("0")) + ret_item.returned_quantity
                )

    eligible_items: List[ReturnEligibleItem] = []
    for item in sale.items:
        sold_qty = item.quantity
        prev_ret_qty = returned_totals.get(item.id, Decimal("0"))
        avail_qty = max(Decimal("0"), sold_qty - prev_ret_qty)

        eligible_items.append(
            ReturnEligibleItem(
                sale_item_id=item.id,
                product_id=item.product_id,
                batch_id=item.batch_id,
                batch_number=item.batch_number,
                product_name=item.product_name,
                company_name=item.company_name,
                net_content=item.net_content,
                sold_quantity=sold_qty,
                previously_returned_quantity=prev_ret_qty,
                available_return_quantity=avail_qty,
                unit_price=item.price,
                gst_rate=item.gst_rate,
                total_price=item.total,
            )
        )

    pm_str = sale.payment_method.value if hasattr(sale.payment_method, "value") else str(sale.payment_method)

    return InvoiceReturnLookupResponse(
        sale_id=sale.id,
        invoice_number=sale.invoice_number,
        sale_date=sale.sale_date,
        customer_name=sale.customer_name,
        customer_phone=sale.customer_phone,
        original_grand_total=sale.grand_total,
        original_payment_method=pm_str,
        items=eligible_items,
        existing_returns_count=len(existing_returns),
    )


@router.post("", response_model=SalesReturnResponse, status_code=201)
def process_sales_return(
    payload: SalesReturnCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Process a sales return:
    1. Validates that invoice exists and items have available return quantity.
    2. Restocks physical inventory for products and batches.
    3. Adds InventoryTransaction audit records.
    4. Calculates taxable refund, GST reversal, and grand total refund.
    5. Saves SalesReturn & SalesReturnItems atomically.
    """
    if not payload.items:
        raise HTTPException(status_code=400, detail="No items selected for return")

    shop_id = getattr(current_user, "shop_id", 1) or 1
    sale = db.query(Sale).options(selectinload(Sale.items)).filter(
        Sale.id == payload.sale_id,
        Sale.shop_id == shop_id
    ).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Original sale invoice not found")

    # Map sale items
    sale_item_map = {item.id: item for item in sale.items}

    # Calculate existing returns per sale_item_id
    existing_returns = db.query(SalesReturn).options(selectinload(SalesReturn.items)).filter(
        SalesReturn.sale_id == sale.id,
        SalesReturn.shop_id == shop_id
    ).all()
    returned_totals: dict[int, Decimal] = {}
    for ret in existing_returns:
        for ret_item in ret.items:
            if ret_item.sale_item_id:
                returned_totals[ret_item.sale_item_id] = (
                    returned_totals.get(ret_item.sale_item_id, Decimal("0")) + ret_item.returned_quantity
                )

    return_date = datetime.utcnow()
    return_number = _generate_return_number(db, return_date, shop_id)

    refund_subtotal = Decimal("0")
    refund_gst_amount = Decimal("0")
    refund_grand_total = Decimal("0")

    created_return_items: List[SalesReturnItem] = []

    try:
        # Deadlock-free pre-locking of involved Product and ProductBatch rows in ascending ID order
        involved_product_ids = sorted({
            sale_item_map[req.sale_item_id].product_id
            for req in payload.items
            if req.sale_item_id in sale_item_map and sale_item_map[req.sale_item_id].product_id
        })
        locked_products = (
            db.query(Product)
            .filter(Product.id.in_(involved_product_ids))
            .order_by(Product.id.asc())
            .with_for_update()
            .all()
        ) if involved_product_ids else []
        products_by_id = {p.id: p for p in locked_products}

        involved_batch_ids = sorted({
            sale_item_map[req.sale_item_id].batch_id
            for req in payload.items
            if req.sale_item_id in sale_item_map and sale_item_map[req.sale_item_id].batch_id
        })
        locked_batches = (
            db.query(ProductBatch)
            .filter(ProductBatch.id.in_(involved_batch_ids))
            .order_by(ProductBatch.id.asc())
            .with_for_update()
            .all()
        ) if involved_batch_ids else []
        batches_by_id = {b.id: b for b in locked_batches}

        # Validate and prepare items
        for req_item in payload.items:
            sale_item = sale_item_map.get(req_item.sale_item_id)
            if not sale_item:
                raise HTTPException(
                    status_code=400,
                    detail=f"Item ID {req_item.sale_item_id} does not belong to this invoice"
                )

            ret_qty = Decimal(str(req_item.returned_quantity))
            if ret_qty <= 0:
                continue

            prev_returned = returned_totals.get(sale_item.id, Decimal("0"))
            available_qty = sale_item.quantity - prev_returned

            if ret_qty > available_qty:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Cannot return {ret_qty} units of '{sale_item.product_name}'. "
                        f"Only {available_qty} units remaining eligible for return."
                    )
                )

            # Financial calculations for this item
            unit_price = sale_item.price
            gst_rate = sale_item.gst_rate
            item_taxable = (ret_qty * unit_price).quantize(Decimal("0.01"))
            item_gst = (item_taxable * gst_rate / Decimal("100")).quantize(Decimal("0.01"))
            item_total = item_taxable + item_gst

            refund_subtotal += item_taxable
            refund_gst_amount += item_gst
            refund_grand_total += item_total

            # Restock Product using pre-locked map
            if sale_item.product_id and sale_item.product_id in products_by_id:
                product = products_by_id[sale_item.product_id]
                prev_stock = product.current_stock or Decimal("0")
                product.current_stock = prev_stock + ret_qty

                # Log inventory transaction
                inv_tx = InventoryTransaction(
                    shop_id=shop_id,
                    product_id=product.id,
                    transaction_type=InventoryTxType.RETURN,
                    quantity=ret_qty,
                    previous_stock=prev_stock,
                    new_stock=product.current_stock,
                    reference_type="RETURN",
                    reference_id=sale.id,
                    notes=f"Sales Return #{return_number} from Invoice #{sale.invoice_number}"
                )
                db.add(inv_tx)

            # Restock Batch if applicable
            if sale_item.batch_id and sale_item.batch_id in batches_by_id:
                batch = batches_by_id[sale_item.batch_id]
                batch.current_stock = (batch.current_stock or Decimal("0")) + ret_qty

            return_item = SalesReturnItem(
                sale_item_id=sale_item.id,
                product_id=sale_item.product_id,
                batch_id=sale_item.batch_id,
                batch_number=sale_item.batch_number,
                product_name=sale_item.product_name,
                company_name=sale_item.company_name,
                net_content=sale_item.net_content,
                returned_quantity=ret_qty,
                unit_price=unit_price,
                gst_rate=gst_rate,
                refund_taxable=item_taxable,
                refund_gst=item_gst,
                refund_total=item_total,
            )
            created_return_items.append(return_item)

        if not created_return_items:
            raise HTTPException(status_code=400, detail="No valid return quantities entered")

        sales_return = SalesReturn(
            shop_id=shop_id,
            return_number=return_number,
            sale_id=sale.id,
            invoice_number=sale.invoice_number,
            customer_name=sale.customer_name,
            customer_phone=sale.customer_phone,
            refund_subtotal=refund_subtotal,
            refund_gst_amount=refund_gst_amount,
            refund_grand_total=refund_grand_total,
            refund_payment_method=payload.refund_payment_method or PaymentMethod.CASH,
            reason=payload.reason or "Customer unused stock return",
            notes=payload.notes,
            return_date=return_date,
            created_by=current_user.id,
        )
        db.add(sales_return)
        db.flush()

        for item in created_return_items:
            item.sales_return_id = sales_return.id
            db.add(item)

        # Audit Log
        try:
            audit = AuditLog(
                user_id=current_user.id,
                action=AuditAction.INVENTORY_ADJUST,
                reference_id=sales_return.id,
                reference_type="sales_returns",
                description=f"Sales Return #{return_number} for Invoice #{sale.invoice_number} (Refund ₹{refund_grand_total})",
            )
            db.add(audit)
        except Exception:
            pass

        db.commit()
        db.refresh(sales_return)
        return sales_return

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to process return: {str(e)}")


@router.get("", response_model=List[SalesReturnResponse])
def get_all_returns(
    search: Optional[str] = Query(None, description="Search by invoice number or return number"),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List recent sales returns."""
    shop_id = getattr(current_user, "shop_id", 1) or 1
    query = db.query(SalesReturn).options(selectinload(SalesReturn.items)).filter(
        SalesReturn.shop_id == shop_id
    ).order_by(desc(SalesReturn.return_date))
    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            (SalesReturn.return_number.ilike(s)) |
            (SalesReturn.invoice_number.ilike(s)) |
            (SalesReturn.customer_name.ilike(s))
        )
    return query.limit(limit).all()


@router.get("/{return_id}", response_model=SalesReturnResponse)
def get_sales_return_by_id(
    return_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get details of a specific sales return."""
    shop_id = getattr(current_user, "shop_id", 1) or 1
    sales_return = db.query(SalesReturn).options(selectinload(SalesReturn.items)).filter(
        SalesReturn.id == return_id,
        SalesReturn.shop_id == shop_id
    ).first()
    if not sales_return:
        raise HTTPException(status_code=404, detail="Sales return record not found")
    return sales_return


@router.get("/{return_id}/pdf")
def download_sales_return_pdf(
    return_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download Credit Note / Sales Return PDF."""
    shop_id = getattr(current_user, "shop_id", 1) or 1
    sales_return = db.query(SalesReturn).filter(
        SalesReturn.id == return_id,
        SalesReturn.shop_id == shop_id
    ).first()
    if not sales_return:
        raise HTTPException(status_code=404, detail="Sales return record not found")

    shop = db.query(ShopSettings).filter(ShopSettings.id == shop_id).first()
    if not shop:
        shop = ShopSettings(shop_name="NockBill Solutions")

    pdf_bytes = generate_sales_return_pdf(sales_return, shop)
    filename = f"CreditNote_{sales_return.return_number}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'}
    )
