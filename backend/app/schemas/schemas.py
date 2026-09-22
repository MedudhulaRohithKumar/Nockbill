from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Any
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
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    gstin: Optional[str] = None
    invoice_prefix: Optional[str] = None
    default_gst_rate: Optional[Decimal] = None
    currency: Optional[str] = None
    thermal_print: Optional[bool] = None

class ShopSettingsResponse(BaseModel):
    id: int
    shop_name: str
    address: Optional[str]
    city: Optional[str]
    state: Optional[str]
    pincode: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    gstin: Optional[str]
    invoice_prefix: str
    invoice_counter: int
    default_gst_rate: Decimal
    currency: str
    thermal_print: bool
    logo_path: Optional[str]

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
    minimum_stock: Optional[Decimal] = None
    min_stock_level: Optional[Decimal] = None
    current_stock: Optional[Decimal] = None
    is_active: Optional[bool] = None

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
    current_stock: Decimal = Decimal("0")
    minimum_stock: Decimal = Decimal("0")
    min_stock_level: Optional[Decimal] = None
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

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
    product_name: str
    company_name: Optional[str] = None
    net_content: Optional[str] = None
    quantity: Decimal = Field(..., gt=0)
    price: Decimal = Field(..., ge=0)
    gst_rate: Decimal = Field(default=Decimal("0"), ge=0)
    manufacture_date: Optional[str] = None
    expiry_date: Optional[str] = None

class SaleCreate(BaseModel):
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    payment_method: PaymentMethod = PaymentMethod.CASH
    notes: Optional[str] = None
    idempotency_key: Optional[str] = None
    items: List[SaleItemCreate] = Field(..., min_length=1)

class SaleItemResponse(BaseModel):
    id: int
    product_id: Optional[int] = None
    product_name: str
    company_name: Optional[str] = None
    net_content: Optional[str] = None
    quantity: Decimal = Decimal("0")
    price: Decimal = Decimal("0")
    gst_rate: Decimal = Decimal("0")
    gst_amount: Decimal = Decimal("0")
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
    gst_5_sales: Decimal
    gst_5_amount: Decimal
    gst_18_sales: Decimal
    gst_18_amount: Decimal
    total_gst: Decimal
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
