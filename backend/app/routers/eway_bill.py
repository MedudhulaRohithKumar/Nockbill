"""
Government GST E-Way Bill Generator Router.
Generates official National Informatics Centre (NIC) standard version 1.0.0123 JSON
for direct bulk/single upload to ewaybillgst.gov.in.
Attaches 12-digit E-Way Bill numbers to sales records for invoice/challan printing.
Strictly scoped by authenticated tenant (current_user.shop_id).
"""
from datetime import datetime, timezone
from decimal import Decimal
import re
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.orm import Session, selectinload

from app.database.base import get_db
from app.models.models import (
    AuditAction,
    AuditLog,
    Sale,
    SaleItem,
    ShopSettings,
    User,
)
from app.utils.auth import get_current_user
from app.utils.helpers import sanitize_code, sanitize_text

router = APIRouter(prefix="/api/eway-bill", tags=["GST E-Way Bill Exporter"])

_DEC_ZERO = Decimal("0.00")

# Standard NIC Unit Code mapping from Indian GST specifications
UNIT_CODE_MAP = {
    "BAGS": "BAG",
    "BAG": "BAG",
    "BOTTLES": "BTL",
    "BOTTLE": "BTL",
    "BTL": "BTL",
    "KG": "KGS",
    "KGS": "KGS",
    "GRAMS": "GMS",
    "GM": "GMS",
    "LITRE": "LTR",
    "LITRES": "LTR",
    "LTR": "LTR",
    "ML": "MLT",
    "PACKETS": "PAC",
    "PACKET": "PAC",
    "POUCHES": "BOX",
    "POUCH": "BOX",
    "PIECES": "NOS",
    "PIECE": "NOS",
    "PCS": "NOS",
    "TONS": "TON",
    "TON": "TON",
}

# State code mapping fallback
STATE_NAME_TO_CODE = {
    "JAMMU AND KASHMIR": 1,
    "HIMACHAL PRADESH": 2,
    "PUNJAB": 3,
    "CHANDIGARH": 4,
    "UTTARAKHAND": 5,
    "HARYANA": 6,
    "DELHI": 7,
    "RAJASTHAN": 8,
    "UTTAR PRADESH": 9,
    "BIHAR": 10,
    "SIKKIM": 11,
    "ARUNACHAL PRADESH": 12,
    "NAGALAND": 13,
    "MANIPUR": 14,
    "MIZORAM": 15,
    "TRIPURA": 16,
    "MEGHALAYA": 17,
    "ASSAM": 18,
    "WEST BENGAL": 19,
    "JHARKHAND": 20,
    "ODISHA": 21,
    "CHHATTISGARH": 22,
    "MADHYA PRADESH": 23,
    "GUJARAT": 24,
    "MAHARASHTRA": 27,
    "ANDHRA PRADESH": 37,
    "KARNATAKA": 29,
    "GOA": 30,
    "KERALA": 32,
    "TAMIL NADU": 33,
    "TELANGANA": 36,
}


class EWayBillGenerateRequest(BaseModel):
    vehicle_no: str = Field(..., min_length=4, max_length=20, description="Vehicle number e.g. TS16AB1234")
    trans_distance_km: int = Field(default=25, ge=1, le=4000, description="Approx transport distance in KM")
    trans_mode: str = Field(default="1", description="1=Road, 2=Rail, 3=Air, 4=Ship")
    vehicle_type: str = Field(default="R", description="R=Regular, O=Over Dimensional Cargo")
    transporter_id: Optional[str] = Field(default=None, max_length=20)
    transporter_name: Optional[str] = Field(default=None, max_length=150)

    @model_validator(mode="after")
    def clean_inputs(self) -> "EWayBillGenerateRequest":
        # Remove spaces and dashes from vehicle number (e.g. 'TS-16 AB 1234' -> 'TS16AB1234')
        clean_veh = re.sub(r"[^a-zA-Z0-9]", "", self.vehicle_no or "").upper()
        if len(clean_veh) < 4:
            raise ValueError("Invalid vehicle number. Must contain at least 4 alphanumeric characters.")
        self.vehicle_no = clean_veh
        if self.transporter_id:
            self.transporter_id = re.sub(r"[^a-zA-Z0-9]", "", self.transporter_id).upper()
        if self.transporter_name:
            self.transporter_name = sanitize_text(self.transporter_name, 150)
        return self


class EWayBillUpdateRequest(BaseModel):
    eway_bill_no: str = Field(..., min_length=12, max_length=20, description="12-digit Government E-Way Bill Number")

    @model_validator(mode="after")
    def clean_ewb(self) -> "EWayBillUpdateRequest":
        clean_no = re.sub(r"\D", "", self.eway_bill_no or "")
        if len(clean_no) < 12:
            raise ValueError("E-Way Bill Number must contain at least 12 digits.")
        self.eway_bill_no = clean_no
        return self


@router.post("/sales/{sale_id}/generate-json")
def generate_eway_bill_json(
    sale_id: int,
    payload: EWayBillGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generates standard National Informatics Centre (NIC) E-Way Bill JSON (version 1.0.0123)
    from a verified tenant sale invoice.
    """
    shop_id = current_user.shop_id

    sale = (
        db.query(Sale)
        .options(selectinload(Sale.items))
        .filter(Sale.id == sale_id, Sale.shop_id == shop_id)
        .first()
    )
    if not sale:
        raise HTTPException(status_code=404, detail="Sale invoice not found.")

    shop = db.query(ShopSettings).filter(ShopSettings.id == shop_id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop settings not found.")

    # Validate supplier GSTIN
    from_gstin = (shop.gstin or "").strip().upper()
    if not from_gstin or len(from_gstin) < 15:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Shop GSTIN is required to generate an E-Way Bill. Please update GSTIN in Shop Management.",
        )

    # Persist the vehicle number onto the Sale row
    sale.vehicle_no = payload.vehicle_no
    db.commit()

    # Determine state codes
    from_state_code = _extract_state_code(from_gstin, shop.state)
    buyer_gstin = (sale.customer_gstin or "").strip().upper()
    is_urp = not buyer_gstin or len(buyer_gstin) < 15
    to_gstin = "URP" if is_urp else buyer_gstin
    to_state_code = _extract_state_code(buyer_gstin, None) if not is_urp else from_state_code

    # Supplier address & PIN
    from_addr1 = sanitize_text(shop.address_line1 or shop.address or "Shop Address", 100)
    from_addr2 = sanitize_text(shop.address_line2 or "", 100)
    from_place = sanitize_text(shop.city or "City", 50)
    from_pincode = _extract_numeric_pincode(shop.pincode, default_pin=500001)

    # Buyer address & PIN
    buyer_name = sanitize_text(sale.customer_name or "Farmer / Buyer", 100)
    to_addr1 = sanitize_text(sale.customer_address or "Delivery Address", 100)
    to_place = sanitize_text(sale.customer_address or from_place, 50)
    to_pincode = from_pincode  # fallback to supplier pincode for rural farmers without pin

    # Format document date as DD/MM/YYYY
    sale_dt = sale.sale_date or datetime.now(timezone.utc)
    doc_date = sale_dt.strftime("%d/%m/%Y")

    # Item breakdown
    item_list = []
    tot_taxable = _DEC_ZERO
    tot_cgst = _DEC_ZERO
    tot_sgst = _DEC_ZERO
    tot_igst = _DEC_ZERO

    for idx, item in enumerate(sale.items, start=1):
        line_total = Decimal(str(item.total or 0)).quantize(Decimal("0.01"))
        line_gst = Decimal(str(item.gst_amount or 0)).quantize(Decimal("0.01"))
        taxable = (line_total - line_gst).quantize(Decimal("0.01")) if line_total > line_gst else line_total
        gst_rate = Decimal(str(item.gst_rate or 0))
        qty = Decimal(str(item.quantity or 1)).quantize(Decimal("0.001"))

        # Raw HSN code as integer
        hsn_digits = re.sub(r"\D", "", item.hsn_code or "")
        hsn_int = int(hsn_digits[:8]) if hsn_digits else 3105  # default 3105 for fertilizer

        unit_str = (item.unit or "BAG").strip().upper()
        nic_unit = UNIT_CODE_MAP.get(unit_str, "BAG")

        if sale.is_interstate:
            igst_rate = gst_rate
            cgst_rate = _DEC_ZERO
            sgst_rate = _DEC_ZERO
            item_igst = (taxable * igst_rate / Decimal("100")).quantize(Decimal("0.01"))
            item_cgst = _DEC_ZERO
            item_sgst = _DEC_ZERO
        else:
            igst_rate = _DEC_ZERO
            cgst_rate = (gst_rate / Decimal("2")).quantize(Decimal("0.01"))
            sgst_rate = (gst_rate / Decimal("2")).quantize(Decimal("0.01"))
            item_cgst = (taxable * cgst_rate / Decimal("100")).quantize(Decimal("0.01"))
            item_sgst = (taxable * sgst_rate / Decimal("100")).quantize(Decimal("0.01"))
            item_igst = _DEC_ZERO

        tot_taxable += taxable
        tot_cgst += item_cgst
        tot_sgst += item_sgst
        tot_igst += item_igst

        item_list.append({
            "itemNo": idx,
            "productName": item.product_name[:100],
            "productDesc": (item.trade_name or item.product_name)[:100],
            "hsnCode": hsn_int,
            "quantity": float(qty),
            "qtyUnit": nic_unit,
            "taxableAmount": float(taxable),
            "sgstRate": float(sgst_rate),
            "cgstRate": float(cgst_rate),
            "igstRate": float(igst_rate),
            "cessRate": 0.0,
        })

    tot_inv_value = Decimal(str(sale.grand_total or (tot_taxable + tot_cgst + tot_sgst + tot_igst))).quantize(Decimal("0.01"))

    # NIC E-Way Bill JSON Object
    bill_data = {
        "userGstin": from_gstin,
        "supplyType": "O",              # Outward supply
        "subSupplyType": "1",           # Supply
        "docType": "INV",               # Tax Invoice
        "docNo": sale.invoice_number,
        "docDate": doc_date,
        "transType": "1",               # Regular transport
        "fromGstin": from_gstin,
        "fromTrdName": shop.shop_name[:100],
        "fromAddr1": from_addr1,
        "fromAddr2": from_addr2,
        "fromPlace": from_place,
        "fromPincode": from_pincode,
        "actFromStateCode": from_state_code,
        "fromStateCode": from_state_code,
        "toGstin": to_gstin,
        "toTrdName": buyer_name,
        "toAddr1": to_addr1,
        "toAddr2": "",
        "toPlace": to_place,
        "toPincode": to_pincode,
        "actToStateCode": to_state_code,
        "toStateCode": to_state_code,
        "totalValue": float(tot_taxable),
        "cgstValue": float(tot_cgst),
        "sgstValue": float(tot_sgst),
        "igstValue": float(tot_igst),
        "cessValue": 0.0,
        "totInvValue": float(tot_inv_value),
        "transMode": payload.trans_mode,
        "transDistance": payload.trans_distance_km,
        "transporterId": payload.transporter_id or "",
        "transporterName": payload.transporter_name or "",
        "transDocNo": "",
        "transDocDate": "",
        "vehicleNo": payload.vehicle_no,
        "vehicleType": payload.vehicle_type,
        "itemList": item_list,
    }

    nic_payload = {
        "version": "1.0.0123",
        "billLists": [bill_data],
    }

    db.add(AuditLog(
        user_id=current_user.id,
        shop_id=shop_id,
        action=AuditAction.SETTINGS_UPDATE,
        reference_id=sale.id,
        reference_type="Sale",
        description=f"Generated NIC E-Way Bill JSON for Invoice {sale.invoice_number} (Vehicle {payload.vehicle_no})",
    ))
    db.commit()

    return {
        "success": True,
        "invoice_number": sale.invoice_number,
        "filename": f"EWB_{sale.invoice_number.replace('/', '_')}.json",
        "eway_bill_data": nic_payload,
        "portal_upload_url": "https://ewaybillgst.gov.in",
        "instructions": "1. Login to ewaybillgst.gov.in\n2. Go to e-Waybill > Generate Bulk\n3. Click 'Choose File', select this JSON, and submit.",
    }


@router.put("/sales/{sale_id}/number")
def save_eway_bill_number(
    sale_id: int,
    payload: EWayBillUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Attach the official 12-digit E-Way Bill Number returned by the government portal
    to the sale record for printing and permanent audit trail.
    """
    shop_id = current_user.shop_id
    sale = db.query(Sale).filter(Sale.id == sale_id, Sale.shop_id == shop_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale invoice not found.")

    sale.eway_bill_no = payload.eway_bill_no
    sale.eway_bill_date = datetime.now(timezone.utc)
    db.commit()

    return {
        "success": True,
        "sale_id": sale.id,
        "invoice_number": sale.invoice_number,
        "eway_bill_no": sale.eway_bill_no,
        "eway_bill_date": sale.eway_bill_date.isoformat(),
        "message": f"E-Way Bill Number {sale.eway_bill_no} attached to invoice successfully.",
    }


def _extract_state_code(gstin: Optional[str], state_name: Optional[str]) -> int:
    """Derive 2-digit numeric GST state code from GSTIN or state name."""
    if gstin and len(gstin) >= 2 and gstin[:2].isdigit():
        code = int(gstin[:2])
        if 1 <= code <= 38:
            return code
    if state_name:
        clean_state = re.sub(r"[^a-zA-Z\s]", "", state_name).strip().upper()
        if clean_state in STATE_NAME_TO_CODE:
            return STATE_NAME_TO_CODE[clean_state]
    return 36  # Default to 36 (Telangana)


def _extract_numeric_pincode(pincode: Optional[str], default_pin: int = 500001) -> int:
    """Parse 6-digit numeric PIN code."""
    if pincode:
        digits = re.sub(r"\D", "", pincode)
        if len(digits) == 6:
            return int(digits)
    return default_pin
