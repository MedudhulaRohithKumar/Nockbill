from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, List, Any, Dict
from datetime import datetime, date
from decimal import Decimal
from app.models.models import (
    UserRole, UnitType, PaymentMethod,
    InventoryTxType, ExpenseCategory, AuditAction
)

# ─── Auth ────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    username: str
    name: str
    role: UserRole

class UserCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)
    role: UserRole = UserRole.STAFF

class UserResponse(BaseModel):
    id: int
    name: str
    username: str
    role: UserRole
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Shop Settings ───────────────────────────────────────────────────────────

class ShopSettingsUpdate(BaseModel):
    shop_name: Optional[str] = None
    proprietor_name: Optional[str] = None
    address: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    gstin: Optional[str] = None
    fertilizer_license_no: Optional[str] = None
    pesticide_license_no: Optional[str] = None
    seed_license_no: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_no: Optional[str] = None
    bank_ifsc: Optional[str] = None
    bank_branch: Optional[str] = None
    upi_id: Optional[str] = None
    invoice_prefix: Optional[str] = None
    default_gst_rate: Optional[Decimal] = None
    currency: Optional[str] = None
    thermal_print: Optional[bool] = None
    terms_conditions: Optional[str] = None

class ShopSettingsResponse(BaseModel):
    id: int
    shop_name: str
    proprietor_name: Optional[str] = None
    address: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    gstin: Optional[str] = None
    fertilizer_license_no: Optional[str] = None
    pesticide_license_no: Optional[str] = None
    seed_license_no: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_no: Optional[str] = None
    bank_ifsc: Optional[str] = None
    bank_branch: Optional[str] = None
    upi_id: Optional[str] = None
    invoice_prefix: str
    invoice_counter: int
    default_gst_rate: Decimal
    currency: str
    thermal_print: bool
    logo_path: Optional[str] = None
    terms_conditions: Optional[str] = None

    class Config:
        from_attributes = True


# ─── Products ────────────────────────────────────────────────────────────────

class ProductCreate(BaseModel):
    product_code: Optional[str] = None
    product_name: str = Field(..., min_length=1, max_length=200)
    name: Optional[str] = None
    company_name: Optional[str] = None
    category: Optional[str] = None
    net_content: Optional[Decimal] = None
    unit: Any = "Bags"
    purchase_price: Decimal = Decimal("0")
    cost_price: Optional[Decimal] = None
    selling_price: Decimal = Decimal("0")
    mrp: Optional[Decimal] = None
    gst_rate: Decimal = Decimal("18")
    manufacture_date: Optional[str] = None  # YYYY-MM
    expiry_date: Optional[str] = None        # YYYY-MM
    batch_number: Optional[str] = None
    hsn_code: Optional[str] = None
    barcode: Optional[str] = None
    variants: Optional[List[Dict[str, Any]]] = None
    current_stock: Decimal = Decimal("0")
    minimum_stock: Decimal = Decimal("5")
    min_stock_level: Optional[Decimal] = None

class ProductUpdate(BaseModel):
    product_code: Optional[str] = None
    product_name: Optional[str] = None
    name: Optional[str] = None
    company_name: Optional[str] = None
    category: Optional[str] = None
    net_content: Optional[Decimal] = None
    unit: Optional[Any] = None
    purchase_price: Optional[Decimal] = None
    cost_price: Optional[Decimal] = None
    selling_price: Optional[Decimal] = None
    mrp: Optional[Decimal] = None
    gst_rate: Optional[Decimal] = None
    manufacture_date: Optional[str] = None
    expiry_date: Optional[str] = None
    batch_number: Optional[str] = None
    hsn_code: Optional[str] = None
    barcode: Optional[str] = None
    variants: Optional[List[Dict[str, Any]]] = None
    minimum_stock: Optional[Decimal] = None
    min_stock_level: Optional[Decimal] = None
    current_stock: Optional[Decimal] = None
    is_active: Optional[bool] = None

class ProductBatchResponse(BaseModel):
    id: int
    product_id: int
    batch_number: str
    manufacture_date: Optional[str] = None
    expiry_date: str
    purchase_price: Decimal = Decimal("0")
    selling_price: Decimal = Decimal("0")
    mrp: Optional[Decimal] = None
    current_stock: Decimal = Decimal("0")
    is_active: bool = True

    class Config:
        from_attributes = True

class ProductResponse(BaseModel):
    id: int
    product_code: Optional[str] = None
    product_name: str
    name: Optional[str] = None
    company_name: Optional[str] = None
    category: Optional[str] = None
    net_content: Optional[Decimal] = None
    unit: Any = "Bags"
    purchase_price: Decimal = Decimal("0")
    cost_price: Optional[Decimal] = None
    selling_price: Decimal = Decimal("0")
    mrp: Optional[Decimal] = None
    gst_rate: Decimal = Decimal("0")
    manufacture_date: Optional[str] = None
    expiry_date: Optional[str] = None
    batch_number: Optional[str] = None
    hsn_code: Optional[str] = None
    barcode: Optional[str] = None
    variants: Optional[List[Dict[str, Any]]] = None
    batches: Optional[List[ProductBatchResponse]] = None
    current_stock: Decimal = Decimal("0")
    minimum_stock: Decimal = Decimal("5")
    min_stock_level: Optional[Decimal] = None
    is_active: bool = True

class ProductRefillRequest(BaseModel):
    product_id: int
    additional_quantity: Optional[Decimal] = None
    quantity: Optional[Decimal] = None
    unit: Optional[str] = None
    purchase_price: Optional[Decimal] = None
    selling_price: Optional[Decimal] = None
    mrp: Optional[Decimal] = None
    new_batch_number: Optional[str] = None
    batch_number: Optional[str] = None
    new_expiry_date: Optional[str] = None
    expiry_date: Optional[str] = None
    supplier_name: Optional[str] = None
    invoice_number: Optional[str] = None
    notes: Optional[str] = None

    @model_validator(mode='before')
    @classmethod
    def normalize_refill_payload(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Support both quantity and additional_quantity
            qty = data.get('additional_quantity') if data.get('additional_quantity') is not None else data.get('quantity')
            if qty is not None:
                data['additional_quantity'] = qty
                data['quantity'] = qty
            # Support both batch_number and new_batch_number
            batch = data.get('new_batch_number') or data.get('batch_number')
            if batch is not None:
                data['new_batch_number'] = batch
                data['batch_number'] = batch
            # Support both expiry_date and new_expiry_date
            exp = data.get('new_expiry_date') or data.get('expiry_date')
            if exp is not None:
                data['new_expiry_date'] = exp
                data['expiry_date'] = exp
        return data

    @model_validator(mode='after')
    def validate_quantities(self) -> 'ProductRefillRequest':
        qty = self.additional_quantity if self.additional_quantity is not None else self.quantity
        if qty is None or qty <= Decimal("0"):
            raise ValueError("Refill inward quantity must be greater than 0")
        if self.additional_quantity is None:
            self.additional_quantity = qty
        if self.quantity is None:
            self.quantity = qty
        return self

class ProductSearchResult(BaseModel):
    id: int
    product_name: str
    name: Optional[str] = None
    company_name: Optional[str] = None
    category: Optional[str] = None
    net_content: Optional[Decimal] = None
    unit: Any = "Bags"
    selling_price: Decimal = Decimal("0")
    cost_price: Optional[Decimal] = None
    gst_rate: Decimal = Decimal("0")
    current_stock: Decimal = Decimal("0")
    expiry_date: Optional[str] = None
    batch_number: Optional[str] = None

    class Config:
        from_attributes = True


# ─── Sales ───────────────────────────────────────────────────────────────────

class SaleItemCreate(BaseModel):
    product_id: Optional[int] = None
    batch_id: Optional[int] = None
    batch_number: Optional[str] = None
    product_name: str
    company_name: Optional[str] = None
    net_content: Optional[str] = None
    quantity: Decimal = Field(..., gt=0)
    price: Optional[Decimal] = None
    unit_price: Optional[Decimal] = None
    gst_rate: Decimal = Field(default=Decimal("0"), ge=0)
    manufacture_date: Optional[str] = None
    expiry_date: Optional[str] = None
    hsn_code: Optional[str] = None
    unit: Optional[str] = None
    mrp: Optional[Decimal] = None
    discount_percent: Optional[Decimal] = None
    discount_amount: Optional[Decimal] = None
    taxable_amount: Optional[Decimal] = None
    cgst_amount: Optional[Decimal] = None
    sgst_amount: Optional[Decimal] = None
    igst_amount: Optional[Decimal] = None
    total_amount: Optional[Decimal] = None

    @model_validator(mode='before')
    @classmethod
    def normalize_sale_item(cls, data: Any) -> Any:
        if isinstance(data, dict):
            p = data.get('price') if data.get('price') is not None else data.get('unit_price')
            if p is not None:
                data['price'] = p
                data['unit_price'] = p
        return data

    @model_validator(mode='after')
    def validate_price(self) -> 'SaleItemCreate':
        p = self.price if self.price is not None else self.unit_price
        if p is None:
            p = Decimal("0")
        self.price = p
        self.unit_price = p
        return self

class SaleCreate(BaseModel):
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_address: Optional[str] = None
    customer_aadhar: Optional[str] = None
    customer_gstin: Optional[str] = None
    payment_method: Optional[Any] = None
    payment_mode: Optional[str] = None
    is_interstate: Optional[bool] = False
    subtotal: Optional[Decimal] = None
    total_discount: Optional[Decimal] = None
    total_taxable: Optional[Decimal] = None
    total_cgst: Optional[Decimal] = None
    total_sgst: Optional[Decimal] = None
    total_igst: Optional[Decimal] = None
    round_off: Optional[Decimal] = None
    grand_total: Optional[Decimal] = None
    notes: Optional[str] = None
    idempotency_key: Optional[str] = None
    items: List[SaleItemCreate] = Field(..., min_length=1)

    @model_validator(mode='before')
    @classmethod
    def normalize_sale_payload(cls, data: Any) -> Any:
        if isinstance(data, dict):
            raw_method = data.get('payment_method') or data.get('payment_mode') or 'CASH'
            if isinstance(raw_method, str):
                m_upper = raw_method.strip().upper()
                if m_upper in [m.value for m in PaymentMethod]:
                    data['payment_method'] = PaymentMethod(m_upper)
                else:
                    data['payment_method'] = PaymentMethod.CASH
            elif isinstance(raw_method, PaymentMethod):
                data['payment_method'] = raw_method
            else:
                data['payment_method'] = PaymentMethod.CASH
        return data

class SaleItemResponse(BaseModel):
    id: int
    product_id: Optional[int] = None
    batch_id: Optional[int] = None
    batch_number: Optional[str] = None
    product_name: str
    company_name: Optional[str] = None
    net_content: Optional[str] = None
    quantity: Decimal = Decimal("0")
    price: Decimal = Decimal("0")
    unit_price: Decimal = Decimal("0")
    unit: Optional[str] = "Bags"
    hsn_code: Optional[str] = "31021000"
    gst_rate: Decimal = Decimal("0")
    gst_amount: Decimal = Decimal("0")
    taxable_amount: Decimal = Decimal("0")
    total_amount: Decimal = Decimal("0")
    total: Decimal = Decimal("0")
    manufacture_date: Optional[str] = None
    expiry_date: Optional[str] = None

    class Config:
        from_attributes = True

class SaleResponse(BaseModel):
    id: int
    invoice_number: str
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_address: Optional[str] = None
    customer_aadhar: Optional[str] = None
    customer_gstin: Optional[str] = None
    subtotal: Decimal = Decimal("0")
    gst_amount: Decimal = Decimal("0")
    grand_total: Decimal = Decimal("0")
    payment_method: PaymentMethod = PaymentMethod.CASH
    payment_mode: Optional[str] = None
    notes: Optional[str] = None
    sale_date: datetime
    invoice_date: Optional[str] = None
    total_taxable: Optional[Decimal] = None
    total_cgst: Optional[Decimal] = None
    total_sgst: Optional[Decimal] = None
    total_igst: Optional[Decimal] = Decimal("0")
    total_discount: Optional[Decimal] = Decimal("0")
    round_off: Optional[Decimal] = Decimal("0")
    status: Optional[str] = "Completed"
    items: List[SaleItemResponse] = []

    class Config:
        from_attributes = True

class SaleListResponse(BaseModel):
    id: int
    invoice_number: str
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    subtotal: Decimal = Decimal("0")
    gst_amount: Decimal = Decimal("0")
    grand_total: Decimal = Decimal("0")
    payment_method: PaymentMethod = PaymentMethod.CASH
    payment_mode: Optional[str] = None
    sale_date: datetime
    invoice_date: Optional[str] = None
    total_taxable: Optional[Decimal] = None
    total_cgst: Optional[Decimal] = None
    total_sgst: Optional[Decimal] = None

    class Config:
        from_attributes = True


# ─── Purchases ───────────────────────────────────────────────────────────────

class PurchaseItemCreate(BaseModel):
    product_id: int
    quantity: Decimal = Field(..., gt=0)
    purchase_price: Decimal = Field(..., ge=0)
    gst_rate: Decimal = Decimal("0")

class PurchaseCreate(BaseModel):
    supplier_name: Optional[str] = None
    supplier_gstin: Optional[str] = None
    invoice_number: Optional[str] = None
    bill_number: Optional[str] = None
    purchase_date: Optional[datetime] = None
    bill_date: Optional[str] = None
    notes: Optional[str] = None
    items: List[PurchaseItemCreate] = Field(..., min_length=1)

class PurchaseItemResponse(BaseModel):
    id: int
    product_id: int
    quantity: Decimal = Decimal("0")
    purchase_price: Decimal = Decimal("0")
    gst_rate: Decimal = Decimal("0")
    total: Decimal = Decimal("0")

    class Config:
        from_attributes = True

class PurchaseResponse(BaseModel):
    id: int
    supplier_name: Optional[str] = None
    supplier_gstin: Optional[str] = None
    invoice_number: Optional[str] = None
    bill_number: Optional[str] = None
    purchase_date: datetime
    bill_date: Optional[str] = None
    subtotal: Decimal = Decimal("0")
    gst_amount: Decimal = Decimal("0")
    total_tax: Optional[Decimal] = None
    grand_total: Decimal = Decimal("0")
    total_amount: Optional[Decimal] = None
    notes: Optional[str] = None
    items: List[PurchaseItemResponse] = []

    class Config:
        from_attributes = True


# ─── Inventory ───────────────────────────────────────────────────────────────

class InventoryAdjustRequest(BaseModel):
    product_id: int
    transaction_type: Optional[InventoryTxType] = InventoryTxType.ADJUSTMENT
    adjustment_type: Optional[str] = None
    quantity: Decimal
    notes: Optional[str] = None
    reason: Optional[str] = None

class InventoryTransactionResponse(BaseModel):
    id: int
    product_id: int
    transaction_type: InventoryTxType
    quantity: Decimal
    previous_stock: Decimal
    new_stock: Decimal
    reference_id: Optional[int]
    reference_type: Optional[str]
    transaction_date: datetime
    notes: Optional[str]

    class Config:
        from_attributes = True


# ─── Expenses ────────────────────────────────────────────────────────────────

class ExpenseCreate(BaseModel):
    expense_name: str = Field(..., min_length=1, max_length=200)
    category: ExpenseCategory = ExpenseCategory.OTHER
    amount: Decimal = Field(..., gt=0)
    expense_date: date
    description: Optional[str] = None

class ExpenseUpdate(BaseModel):
    expense_name: Optional[str] = None
    category: Optional[ExpenseCategory] = None
    amount: Optional[Decimal] = None
    expense_date: Optional[date] = None
    description: Optional[str] = None

class ExpenseResponse(BaseModel):
    id: int
    expense_name: str
    category: ExpenseCategory
    amount: Decimal
    expense_date: date
    description: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ─── OCR ─────────────────────────────────────────────────────────────────────

class OcrConfidence(BaseModel):
    product_name: float = 0.0
    net_content: float = 0.0
    unit: float = 0.0
    price: float = 0.0
    company_name: float = 0.0
    manufacture_date: float = 0.0
    expiry_date: float = 0.0
    gst_rate: float = 0.0
    batch_number: float = 0.0
    hsn_code: float = 0.0

class OcrResult(BaseModel):
    product_name: Optional[str] = None
    batch_number: Optional[str] = None
    quantity: int = 1
    net_content: Optional[str] = None
    unit: Optional[str] = None
    price: Optional[float] = None
    mrp: Optional[float] = None
    selling_price: Optional[float] = None
    cost_price: Optional[float] = None
    hsn_code: Optional[str] = None
    company_name: Optional[str] = None
    manufacture_date: Optional[str] = None
    expiry_date: Optional[str] = None
    gst_rate: Optional[float] = None
    raw_text: Optional[str] = None
    confidence: OcrConfidence = OcrConfidence()
    matched_product: Optional[ProductResponse] = None


# ─── Reports ─────────────────────────────────────────────────────────────────

class DateRangeFilter(BaseModel):
    from_date: Optional[date] = None
    to_date: Optional[date] = None

class GstReportRow(BaseModel):
    transaction_date: datetime
    invoice_number: str
    taxable_amount: Decimal
    gst_rate: Decimal
    gst_amount: Decimal
    total: Decimal

class GstReportSummary(BaseModel):
    period: str
    total_sales: Decimal
    taxable_amount: Decimal
    total_taxable: Optional[Decimal] = None
    total_cgst: Optional[Decimal] = None
    total_sgst: Optional[Decimal] = None
    total_igst: Optional[Decimal] = None
    total_tax: Optional[Decimal] = None
    gst_5_sales: Decimal
    gst_5_amount: Decimal
    gst_18_sales: Decimal
    gst_18_amount: Decimal
    total_gst: Decimal
    gst_breakdown: Optional[List[Dict[str, Any]]] = None
    rows: List[GstReportRow] = []

class StockReportRow(BaseModel):
    product_id: int
    product_name: str
    company_name: Optional[str]
    net_content: Optional[str]
    opening_stock: Decimal
    purchased: Decimal
    sold: Decimal
    returned: Decimal
    damaged: Decimal
    current_stock: Decimal
    minimum_stock: Decimal
    stock_value: Decimal

class ProfitLossReport(BaseModel):
    period: str
    total_sales: Decimal
    cost_of_goods: Decimal
    gross_profit: Decimal
    total_expenses: Decimal
    net_profit: Decimal


# ─── Pagination ──────────────────────────────────────────────────────────────

class PaginatedResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[Any] = []
