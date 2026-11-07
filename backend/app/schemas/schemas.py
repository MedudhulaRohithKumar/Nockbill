from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, List, Any, Dict
from datetime import datetime, date
from decimal import Decimal
from app.models.models import (
    UserRole, UnitType, PaymentMethod,
    InventoryTxType, ExpenseCategory, AuditAction
)
from app.utils.helpers import (
    sanitize_text,
    sanitize_code,
    validate_phone,
    validate_pincode,
    validate_ifsc,
    validate_gstin,
    resolve_trade_name,
)

# ─── Auth ────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=1, max_length=200)

    @field_validator("username")
    @classmethod
    def clean_username(cls, v: str) -> str:
        cleaned = sanitize_text(v, max_length=100)
        if not cleaned:
            raise ValueError("Username is required")
        return cleaned

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    username: str
    name: str
    role: UserRole
    subscription_status: Optional[str] = "ACTIVE"

class UserCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)
    email: Optional[str] = None
    phone: Optional[str] = None
    role: UserRole = UserRole.STAFF

class UserResponse(BaseModel):
    id: int
    name: str
    username: str
    email: Optional[str] = None
    phone: Optional[str] = None
    role: UserRole
    subscription_status: Optional[str] = "ACTIVE"
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ShopRegistrationRequest(BaseModel):
    # Owner credentials
    owner_name: str = Field(..., min_length=1, max_length=100)
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6, max_length=128)
    email: Optional[str] = None
    phone: Optional[str] = None

    # Shop Info
    shop_name: str = Field(..., min_length=2, max_length=200)
    proprietor_name: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    gstin: Optional[str] = None
    fertilizer_license_no: Optional[str] = None
    pesticide_license_no: Optional[str] = None
    seed_license_no: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_no: Optional[str] = None
    bank_ifsc: Optional[str] = None
    bank_branch: Optional[str] = None
    upi_id: Optional[str] = None
    default_gst_rate: Optional[Decimal] = Decimal("18.00")
    invoice_prefix: Optional[str] = "INV"

    @model_validator(mode="after")
    def sanitize_registration(self) -> "ShopRegistrationRequest":
        self.owner_name = sanitize_text(self.owner_name, 100) or ""
        self.username = sanitize_code(self.username, 50) or ""
        self.shop_name = sanitize_text(self.shop_name, 200) or ""
        if len(self.shop_name) < 2:
            raise ValueError("Shop name must be at least 2 characters")
        self.proprietor_name = sanitize_text(self.proprietor_name, 150)
        self.address_line1 = sanitize_text(self.address_line1, 250)
        self.address_line2 = sanitize_text(self.address_line2, 250)
        self.city = sanitize_text(self.city, 100)
        self.state = sanitize_text(self.state, 100)
        self.phone = validate_phone(self.phone) if self.phone else None
        self.pincode = validate_pincode(self.pincode) if self.pincode else None
        self.gstin = validate_gstin(self.gstin) if self.gstin else None
        self.fertilizer_license_no = sanitize_code(self.fertilizer_license_no, 100)
        self.pesticide_license_no = sanitize_code(self.pesticide_license_no, 100)
        self.seed_license_no = sanitize_code(self.seed_license_no, 100)
        self.bank_name = sanitize_text(self.bank_name, 150)
        self.bank_account_no = sanitize_code(self.bank_account_no, 40)
        self.bank_ifsc = validate_ifsc(self.bank_ifsc) if self.bank_ifsc else None
        self.bank_branch = sanitize_text(self.bank_branch, 150)
        self.upi_id = sanitize_text(self.upi_id, 100)
        self.invoice_prefix = (sanitize_code(self.invoice_prefix, 15, uppercase=True) or "INV")
        return self


class RegistrationResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    username: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    role: UserRole
    shop_name: str
    subscription_status: str
    credentials: dict


class SubscriptionPaymentRequest(BaseModel):
    plan_id: str
    plan_name: str
    amount: float
    payment_method: str = "UPI"
    payment_ref: str



class ForgotPasswordRequest(BaseModel):
    identifier: str


class ResetPasswordRequest(BaseModel):
    identifier: str
    reset_token: str
    new_password: str = Field(..., min_length=6)


class GoogleAuthRequest(BaseModel):
    credential: str = Field(..., description="Google ID Token JWT returned by Google Identity Services or OAuth2 token")
    shop_name: Optional[str] = Field(None, description="Optional shop name if user is signing up for the first time")
    password: Optional[str] = Field(None, min_length=6, description="Optional password for hybrid email+password login")
    phone: Optional[str] = Field(None, description="Optional mobile phone number")
    gstin: Optional[str] = Field(None, description="Optional GSTIN")



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

    @model_validator(mode="after")
    def sanitize_settings(self) -> "ShopSettingsUpdate":
        if self.shop_name is not None:
            self.shop_name = sanitize_text(self.shop_name, 200)
            if not self.shop_name or len(self.shop_name) < 2:
                raise ValueError("Shop name must be at least 2 characters")
        if self.proprietor_name is not None:
            self.proprietor_name = sanitize_text(self.proprietor_name, 150)
        if self.address is not None:
            self.address = sanitize_text(self.address, 500, allow_newlines=True)
        if self.address_line1 is not None:
            self.address_line1 = sanitize_text(self.address_line1, 250)
        if self.address_line2 is not None:
            self.address_line2 = sanitize_text(self.address_line2, 250)
        if self.city is not None:
            self.city = sanitize_text(self.city, 100)
        if self.state is not None:
            self.state = sanitize_text(self.state, 100)
        if self.pincode:
            self.pincode = validate_pincode(self.pincode)
        if self.phone:
            self.phone = validate_phone(self.phone)
        if self.gstin:
            self.gstin = validate_gstin(self.gstin)
        if self.bank_ifsc:
            self.bank_ifsc = validate_ifsc(self.bank_ifsc)
        if self.invoice_prefix is not None:
            self.invoice_prefix = sanitize_code(self.invoice_prefix, 15, uppercase=True) or "INV"
        if self.terms_conditions is not None:
            self.terms_conditions = sanitize_text(self.terms_conditions, 2000, allow_newlines=True)
        return self

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
    trade_name: Optional[str] = None
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

    @model_validator(mode="after")
    def sanitize_and_validate_product(self) -> "ProductCreate":
        self.product_name = sanitize_text(self.product_name or self.name, 200) or ""
        if not self.product_name:
            raise ValueError("Product name cannot be empty")
        self.name = self.product_name
        self.company_name = sanitize_text(self.company_name, 200)
        self.trade_name = resolve_trade_name(self.product_name, self.company_name, self.trade_name)
        self.product_code = sanitize_code(self.product_code, 100, uppercase=True) if self.product_code else None
        self.batch_number = sanitize_code(self.batch_number, 100) if self.batch_number else None
        self.hsn_code = sanitize_code(self.hsn_code, 50) or "31021000"
        self.barcode = sanitize_code(self.barcode, 100) if self.barcode else None
        if self.selling_price < Decimal("0"):
            raise ValueError("Selling price cannot be negative")
        if self.purchase_price < Decimal("0"):
            raise ValueError("Purchase price cannot be negative")
        if self.cost_price is not None and self.cost_price < Decimal("0"):
            raise ValueError("Cost price cannot be negative")
        if self.mrp is not None and self.mrp < Decimal("0"):
            raise ValueError("MRP cannot be negative")
        if self.gst_rate < Decimal("0") or self.gst_rate > Decimal("100"):
            raise ValueError("GST rate must be between 0% and 100%")
        if self.current_stock < Decimal("0"):
            raise ValueError("Initial stock cannot be negative")
        if self.minimum_stock < Decimal("0"):
            raise ValueError("Minimum stock alert level cannot be negative")
        return self

class ProductUpdate(BaseModel):
    product_code: Optional[str] = None
    product_name: Optional[str] = None
    name: Optional[str] = None
    company_name: Optional[str] = None
    trade_name: Optional[str] = None
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

    @model_validator(mode="after")
    def sanitize_product_update(self) -> "ProductUpdate":
        if self.product_name is not None:
            self.product_name = sanitize_text(self.product_name, 200)
        if self.name is not None:
            self.name = sanitize_text(self.name, 200)
        if self.company_name is not None:
            self.company_name = sanitize_text(self.company_name, 200)
        if self.trade_name is not None:
            self.trade_name = sanitize_text(self.trade_name, 200)
        if self.batch_number is not None:
            self.batch_number = sanitize_code(self.batch_number, 100)
        if self.hsn_code is not None:
            self.hsn_code = sanitize_code(self.hsn_code, 50)
        if self.selling_price is not None and self.selling_price < Decimal("0"):
            raise ValueError("Selling price cannot be negative")
        if self.purchase_price is not None and self.purchase_price < Decimal("0"):
            raise ValueError("Purchase price cannot be negative")
        if self.cost_price is not None and self.cost_price < Decimal("0"):
            raise ValueError("Cost price cannot be negative")
        return self

class ProductBatchResponse(BaseModel):
    id: int
    product_id: int
    batch_number: str
    trade_name: Optional[str] = None
    company_name: Optional[str] = None
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
    trade_name: Optional[str] = None
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
    company_name: Optional[str] = None
    trade_name: Optional[str] = None
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
        if self.purchase_price is not None and self.purchase_price < Decimal("0"):
            raise ValueError("Purchase price cannot be negative")
        if self.selling_price is not None and self.selling_price < Decimal("0"):
            raise ValueError("Selling price cannot be negative")
        if self.mrp is not None and self.mrp < Decimal("0"):
            raise ValueError("MRP cannot be negative")
        self.company_name = sanitize_text(self.company_name, 200) if self.company_name else None
        self.trade_name = sanitize_text(self.trade_name, 200) if self.trade_name else None
        self.new_batch_number = sanitize_code(self.new_batch_number, 100) if self.new_batch_number else None
        self.batch_number = self.new_batch_number
        self.supplier_name = sanitize_text(self.supplier_name, 200) if self.supplier_name else None
        self.invoice_number = sanitize_code(self.invoice_number, 100) if self.invoice_number else None
        self.notes = sanitize_text(self.notes, 500) if self.notes else None
        return self

class ProductSearchResult(BaseModel):
    id: int
    product_name: str
    name: Optional[str] = None
    company_name: Optional[str] = None
    trade_name: Optional[str] = None
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
    trade_name: Optional[str] = None
    net_content: Optional[str] = None
    quantity: Decimal = Field(..., gt=0)
    price: Optional[Decimal] = None
    unit_price: Optional[Decimal] = None
    gst_rate: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    manufacture_date: Optional[str] = None
    expiry_date: Optional[str] = None
    hsn_code: Optional[str] = None
    unit: Optional[str] = None
    mrp: Optional[Decimal] = None
    discount_percent: Optional[Decimal] = Field(default=Decimal("0"), ge=0, le=100)
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
        if p < Decimal("0"):
            raise ValueError("Item unit price cannot be negative")
        self.price = p
        self.unit_price = p
        self.product_name = sanitize_text(self.product_name, 200) or "Product"
        self.company_name = sanitize_text(self.company_name, 200) if self.company_name else None
        self.trade_name = sanitize_text(self.trade_name, 200) if self.trade_name else None
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
    payment_details: Optional[str] = None
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

    @model_validator(mode='after')
    def sanitize_sale(self) -> 'SaleCreate':
        self.customer_name = sanitize_text(self.customer_name, 150) if self.customer_name else "Walk-in Farmer"
        if self.customer_phone and self.customer_phone.strip():
            self.customer_phone = validate_phone(self.customer_phone)
        else:
            self.customer_phone = None
        self.customer_address = sanitize_text(self.customer_address, 300) if self.customer_address else None
        self.customer_gstin = validate_gstin(self.customer_gstin) if self.customer_gstin else None
        self.notes = sanitize_text(self.notes, 500) if self.notes else None
        return self

class SaleItemResponse(BaseModel):
    id: int
    product_id: Optional[int] = None
    batch_id: Optional[int] = None
    batch_number: Optional[str] = None
    product_name: str
    company_name: Optional[str] = None
    trade_name: Optional[str] = None
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
    payment_details: Optional[str] = None
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
    product_name: Optional[str] = None
    company_name: Optional[str] = None
    trade_name: Optional[str] = None
    quantity: Decimal = Field(..., gt=0)
    purchase_price: Decimal = Field(..., ge=0)
    gst_rate: Decimal = Field(default=Decimal("0"), ge=0, le=100)

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
    product_name: Optional[str] = None
    company_name: Optional[str] = None
    trade_name: Optional[str] = None
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
    quantity: Decimal = Field(..., gt=0)
    notes: Optional[str] = None
    reason: Optional[str] = None

    @model_validator(mode="after")
    def sanitize_adjust(self) -> "InventoryAdjustRequest":
        self.notes = sanitize_text(self.notes, 500) if self.notes else None
        self.reason = sanitize_text(self.reason, 500) if self.reason else None
        return self

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

    @model_validator(mode="after")
    def sanitize_expense(self) -> "ExpenseCreate":
        self.expense_name = sanitize_text(self.expense_name, 200) or "Expense"
        self.description = sanitize_text(self.description, 500) if self.description else None
        return self

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
    trade_name: Optional[str] = None
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


# ─── Sales Return Schemas ───────────────────────────────────────────────────

class SalesReturnItemCreate(BaseModel):
    sale_item_id: int
    returned_quantity: Decimal

class SalesReturnCreate(BaseModel):
    sale_id: int
    invoice_number: str
    refund_payment_method: Optional[Any] = "CASH"
    reason: Optional[str] = "Customer return / unused stock"
    notes: Optional[str] = None
    items: List[SalesReturnItemCreate]

    @model_validator(mode='before')
    @classmethod
    def normalize_return_payload(cls, data: Any) -> Any:
        if isinstance(data, dict):
            raw_method = data.get('refund_payment_method') or data.get('payment_mode') or 'CASH'
            if isinstance(raw_method, str):
                m_upper = raw_method.strip().upper()
                if m_upper in [m.value for m in PaymentMethod]:
                    data['refund_payment_method'] = PaymentMethod(m_upper)
                else:
                    data['refund_payment_method'] = PaymentMethod.CASH
            elif isinstance(raw_method, PaymentMethod):
                data['refund_payment_method'] = raw_method
            else:
                data['refund_payment_method'] = PaymentMethod.CASH
        return data

class SalesReturnItemResponse(BaseModel):
    id: int
    sales_return_id: int
    sale_item_id: Optional[int] = None
    product_id: Optional[int] = None
    batch_id: Optional[int] = None
    batch_number: Optional[str] = None
    product_name: str
    company_name: Optional[str] = None
    net_content: Optional[str] = None
    returned_quantity: Decimal
    unit_price: Decimal
    gst_rate: Decimal
    refund_taxable: Decimal
    refund_gst: Decimal
    refund_total: Decimal

    class Config:
        from_attributes = True

class SalesReturnResponse(BaseModel):
    id: int
    return_number: str
    sale_id: int
    invoice_number: str
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    refund_subtotal: Decimal
    refund_gst_amount: Decimal
    refund_grand_total: Decimal
    refund_payment_method: PaymentMethod = PaymentMethod.CASH
    reason: Optional[str] = None
    notes: Optional[str] = None
    return_date: datetime
    created_at: datetime
    items: List[SalesReturnItemResponse] = []

    class Config:
        from_attributes = True

class ReturnEligibleItem(BaseModel):
    sale_item_id: int
    product_id: Optional[int] = None
    batch_id: Optional[int] = None
    batch_number: Optional[str] = None
    product_name: str
    company_name: Optional[str] = None
    net_content: Optional[str] = None
    unit: Optional[str] = None
    sold_quantity: Decimal
    previously_returned_quantity: Decimal
    available_return_quantity: Decimal
    unit_price: Decimal
    gst_rate: Decimal
    total_price: Decimal

class InvoiceReturnLookupResponse(BaseModel):
    sale_id: int
    invoice_number: str
    sale_date: datetime
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    original_grand_total: Decimal
    original_payment_method: str
    items: List[ReturnEligibleItem]
    existing_returns_count: int

