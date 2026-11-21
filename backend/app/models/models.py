import enum
from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Date,
    Text, ForeignKey, Enum as SAEnum, Numeric, BigInteger, Index
)
from sqlalchemy.orm import relationship
from app.database.base import Base


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


# ─── Enumerations ────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    OWNER = "OWNER"
    STAFF = "STAFF"


class UnitType(str, enum.Enum):
    ML = "ml"
    LITER = "liter"
    LITRE = "Litre"
    LITRES = "Litres"
    GRAM = "gram"
    GRAMS = "Grams"
    KG = "Kg"
    BAGS = "Bags"
    PACKETS = "Packets"
    POUCHES = "Pouches"
    TONS = "Tons"
    BOTTLES = "Bottles"
    PCS = "pcs"
    PIECES = "Pieces"
    NOS = "Nos"
    SETS = "Sets"
    METERS = "Meters"
    ROLLS = "Rolls"

    def __str__(self) -> str:
        return self.value


class PaymentMethod(str, enum.Enum):
    CASH = "CASH"
    UPI = "UPI"
    CARD = "CARD"
    CREDIT = "CREDIT"


class InventoryTxType(str, enum.Enum):
    PURCHASE = "PURCHASE"
    SALE = "SALE"
    RETURN = "RETURN"
    ADJUSTMENT = "ADJUSTMENT"
    DAMAGE = "DAMAGE"
    EXPIRY = "EXPIRY"


class ExpenseCategory(str, enum.Enum):
    RENT = "RENT"
    ELECTRICITY = "ELECTRICITY"
    SALARY = "SALARY"
    TRANSPORTATION = "TRANSPORTATION"
    INTERNET = "INTERNET"
    MAINTENANCE = "MAINTENANCE"
    PACKAGING = "PACKAGING"
    OFFICE = "OFFICE"
    OTHER = "OTHER"


class AuditAction(str, enum.Enum):
    LOGIN = "LOGIN"
    LOGOUT = "LOGOUT"
    PRODUCT_CREATE = "PRODUCT_CREATE"
    PRODUCT_UPDATE = "PRODUCT_UPDATE"
    PRODUCT_DELETE = "PRODUCT_DELETE"
    SALE_CREATE = "SALE_CREATE"
    SALE_RETURN = "SALE_RETURN"
    PURCHASE_CREATE = "PURCHASE_CREATE"
    INVENTORY_ADJUST = "INVENTORY_ADJUST"
    EXPENSE_CREATE = "EXPENSE_CREATE"
    EXPENSE_UPDATE = "EXPENSE_UPDATE"
    EXPENSE_DELETE = "EXPENSE_DELETE"
    SETTINGS_UPDATE = "SETTINGS_UPDATE"


# ─── Models ──────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(256), nullable=False)
    role = Column(SAEnum(UserRole), default=UserRole.STAFF, nullable=False)
    email = Column(String(150), nullable=True, index=True)
    phone = Column(String(20), nullable=True, index=True)
    # Google account subject (stable id). Required before an existing account may be linked to Google.
    google_sub = Column(String(64), unique=True, nullable=True, index=True)
    # Incremented on logout and password reset to immediately revoke all previously issued JWTs (S6).
    token_version = Column(Integer, default=1, nullable=False)
    shop_id = Column(Integer, ForeignKey("shop_settings.id"), nullable=False, index=True)
    subscription_status = Column(String(20), default="ACTIVE")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_utc_now)
    updated_at = Column(DateTime, default=_utc_now, onupdate=_utc_now)

    audit_logs = relationship("AuditLog", back_populates="user")
    shop = relationship("ShopSettings")


class ShopSettings(Base):
    __tablename__ = "shop_settings"

    id = Column(Integer, primary_key=True, index=True)
    shop_name = Column(String(200), nullable=False, default="My Fertilizer Shop")
    proprietor_name = Column(String(200))
    address = Column(Text)
    address_line1 = Column(String(500))
    address_line2 = Column(String(500))
    city = Column(String(100))
    state = Column(String(100))
    pincode = Column(String(10))
    phone = Column(String(20))
    email = Column(String(150))
    gstin = Column(String(20))
    fertilizer_license_no = Column(String(100))
    pesticide_license_no = Column(String(100))
    seed_license_no = Column(String(100))
    bank_name = Column(String(200))
    bank_account_no = Column(String(50))
    bank_ifsc = Column(String(20))
    bank_branch = Column(String(200))
    upi_id = Column(String(100))
    invoice_prefix = Column(String(10), default="INV")
    invoice_counter = Column(Integer, default=1)
    logo_path = Column(Text)
    default_gst_rate = Column(Numeric(5, 2), default=18)
    currency = Column(String(5), default="INR")
    thermal_print = Column(Boolean, default=False)
    terms_conditions = Column(Text)
    invoice_template = Column(String(40), default="CLASSIC_GST")
    invoice_accent_color = Column(String(20), default="#15803d")
    invoice_header_tagline = Column(String(250))
    invoice_footer_note = Column(String(300), default="Thank you for your business! Visit again.")
    invoice_signature_label = Column(String(120), default="Authorized Signatory")
    invoice_show_logo = Column(Boolean, default=True)
    invoice_show_licenses = Column(Boolean, default=True)
    invoice_show_bank_details = Column(Boolean, default=True)
    invoice_show_batch_expiry = Column(Boolean, default=True)
    invoice_show_hsn = Column(Boolean, default=True)
    subscription_status = Column(String(20), default="ACTIVE")
    updated_at = Column(DateTime, default=_utc_now, onupdate=_utc_now)


class PriceList(Base):
    __tablename__ = "price_lists"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shop_settings.id"), nullable=False, index=True)
    name = Column(String(150), nullable=False, index=True)
    description = Column(String(500), nullable=True)
    adjustment_type = Column(String(20), nullable=False, default="DISCOUNT")   # "DISCOUNT" or "INCREMENT"
    calculation_mode = Column(String(20), nullable=False, default="PERCENTAGE") # "PERCENTAGE" or "FIXED"
    adjustment_value = Column(Numeric(12, 2), nullable=False, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_utc_now)
    updated_at = Column(DateTime, default=_utc_now, onupdate=_utc_now)

    products = relationship("Product", back_populates="price_list")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shop_settings.id"), nullable=False, index=True)
    product_code = Column(String(50), index=True)
    product_name = Column(String(200), nullable=False, index=True)
    company_name = Column(String(200), index=True)
    trade_name = Column(String(200), index=True, nullable=True)
    category = Column(String(100), default="Fertilizer", index=True)
    batch_number = Column(String(100), nullable=True, index=True)
    net_content = Column(Numeric(10, 3))
    unit = Column(String(30), default="Bags")
    purchase_price = Column(Numeric(12, 2), default=0)
    base_selling_price = Column(Numeric(12, 2), nullable=True)
    selling_price = Column(Numeric(12, 2), nullable=False)
    price_list_id = Column(Integer, ForeignKey("price_lists.id", ondelete="SET NULL"), nullable=True, index=True)
    gst_rate = Column(Numeric(5, 2), default=18)
    manufacture_date = Column(String(10))   # stored as YYYY-MM or YYYY-MM-DD (also Date of Test for Seeds)
    expiry_date = Column(String(10))        # stored as YYYY-MM or YYYY-MM-DD (also Valid Upto for Seeds)
    current_stock = Column(Numeric(12, 3), default=0)
    minimum_stock = Column(Numeric(12, 3), default=5)
    # Barcodes are unique PER SHOP (see uq_product_shop_barcode), never table-wide:
    # every tenant's sequential generator starts at 10001.
    barcode = Column(String(100), index=True, nullable=True)
    hsn_code = Column(String(50), nullable=True)
    category_attributes = Column(Text, nullable=True)  # JSON dict of category-specific compliance metadata
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_utc_now)
    updated_at = Column(DateTime, default=_utc_now, onupdate=_utc_now)

    price_list = relationship("PriceList", back_populates="products")
    sale_items = relationship("SaleItem", back_populates="product")
    purchase_items = relationship("PurchaseItem", back_populates="product")
    inventory_transactions = relationship("InventoryTransaction", back_populates="product")
    variants = relationship("ProductVariant", back_populates="product", cascade="all, delete-orphan")
    batches = relationship("ProductBatch", back_populates="product", cascade="all, delete-orphan", order_by="ProductBatch.expiry_date.asc()")

    __table_args__ = (
        Index("ix_product_name_company", "product_name", "company_name"),
        Index("ix_product_shop_active", "shop_id", "is_active"),
        Index("ix_product_shop_trade", "shop_id", "trade_name"),
        Index("uq_product_shop_barcode", "shop_id", "barcode", unique=True),
    )


class ProductBatch(Base):
    __tablename__ = "product_batches"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    batch_number = Column(String(100), nullable=False, index=True)
    trade_name = Column(String(200), nullable=True, index=True)
    company_name = Column(String(200), nullable=True)
    manufacture_date = Column(String(10))   # YYYY-MM or YYYY-MM-DD
    expiry_date = Column(String(10), nullable=True, index=True)  # nullable for non-expiring categories (SC7)
    purchase_price = Column(Numeric(12, 2), default=0)
    selling_price = Column(Numeric(12, 2), nullable=False)
    mrp = Column(Numeric(12, 2), nullable=True)
    current_stock = Column(Numeric(12, 3), default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_utc_now)

    product = relationship("Product", back_populates="batches")
    sale_items = relationship("SaleItem", back_populates="batch")


class ProductVariant(Base):
    __tablename__ = "product_variants"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    variant_name = Column(String(100), nullable=False)   # e.g. "250 ml", "500 ml", "1 Liter", "50 kg"
    unit_size = Column(Numeric(10, 3), nullable=False)   # e.g. 250
    unit = Column(String(30), nullable=False)            # e.g. "ml", "liter", "gram", "kg", "Bags"
    purchase_price = Column(Numeric(12, 2), default=0)
    selling_price = Column(Numeric(12, 2), nullable=False)
    mrp = Column(Numeric(12, 2), nullable=True)
    stock = Column(Numeric(12, 3), default=0)
    barcode = Column(String(100), index=True, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_utc_now)

    product = relationship("Product", back_populates="variants")


class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shop_settings.id"), nullable=False, index=True)
    invoice_number = Column(String(50), nullable=False, index=True)
    idempotency_key = Column(String(100), nullable=True, index=True)  # unique per shop via uq_sale_shop_idempotency
    customer_name = Column(String(200))
    customer_phone = Column(String(20))
    customer_address = Column(String(300), nullable=True)
    customer_aadhar = Column(String(20), nullable=True)
    customer_gstin = Column(String(20), nullable=True)
    is_interstate = Column(Boolean, default=False)
    subtotal = Column(Numeric(14, 2), default=0)
    total_discount = Column(Numeric(14, 2), default=0)
    gst_amount = Column(Numeric(14, 2), default=0)
    total_igst = Column(Numeric(14, 2), default=0)
    round_off = Column(Numeric(8, 2), default=0)
    grand_total = Column(Numeric(14, 2), default=0)
    payment_method = Column(SAEnum(PaymentMethod), default=PaymentMethod.CASH)
    vehicle_no = Column(String(30), nullable=True)
    eway_bill_no = Column(String(50), nullable=True)
    eway_bill_date = Column(DateTime, nullable=True)
    notes = Column(Text)
    sale_date = Column(DateTime, default=_utc_now, index=True)
    created_at = Column(DateTime, default=_utc_now)
    created_by = Column(Integer, ForeignKey("users.id"))

    items = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan")
    returns = relationship("SalesReturn", back_populates="sale", cascade="all, delete-orphan")
    gst_transactions = relationship("GstTransaction", back_populates="sale")

    __table_args__ = (
        Index("ix_sale_shop_date", "shop_id", "sale_date"),
        Index("uq_sale_shop_invoice", "shop_id", "invoice_number", unique=True),
        Index("uq_sale_shop_idempotency", "shop_id", "idempotency_key", unique=True),
    )


class SaleItem(Base):
    __tablename__ = "sale_items"

    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True, index=True)  # nullable: product may be deleted
    batch_id = Column(Integer, ForeignKey("product_batches.id", ondelete="SET NULL"), nullable=True)
    batch_number = Column(String(100), nullable=True)
    # Snapshot of product at time of sale
    product_name = Column(String(200), nullable=False)
    company_name = Column(String(200))
    trade_name = Column(String(200), nullable=True)
    hsn_code = Column(String(50), nullable=True)
    unit = Column(String(30), nullable=True)
    net_content = Column(String(50))
    quantity = Column(Numeric(10, 3), nullable=False)
    price = Column(Numeric(12, 2), nullable=False)      # per unit selling price
    mrp = Column(Numeric(12, 2), nullable=True)
    discount_percent = Column(Numeric(5, 2), default=0)
    discount_amount = Column(Numeric(14, 2), default=0)
    # Snapshot of the unit purchase cost at the moment of sale so historical P&L never
    # changes when the product is later refilled at a different rate.
    cost_price = Column(Numeric(12, 2), nullable=True)
    gst_rate = Column(Numeric(5, 2), default=0)
    gst_amount = Column(Numeric(14, 2), default=0)
    total = Column(Numeric(14, 2), default=0)           # including GST
    manufacture_date = Column(String(10))
    expiry_date = Column(String(10))

    sale = relationship("Sale", back_populates="items")
    product = relationship("Product", back_populates="sale_items")
    batch = relationship("ProductBatch", back_populates="sale_items")


class Purchase(Base):
    __tablename__ = "purchases"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shop_settings.id"), nullable=False, index=True)
    supplier_name = Column(String(200))
    supplier_gstin = Column(String(20), nullable=True)
    invoice_number = Column(String(100))
    purchase_date = Column(DateTime, default=_utc_now, index=True)
    subtotal = Column(Numeric(14, 2), default=0)
    gst_amount = Column(Numeric(14, 2), default=0)
    grand_total = Column(Numeric(14, 2), default=0)
    notes = Column(Text)
    created_at = Column(DateTime, default=_utc_now)
    created_by = Column(Integer, ForeignKey("users.id"))

    items = relationship("PurchaseItem", back_populates="purchase", cascade="all, delete-orphan")


class PurchaseItem(Base):
    __tablename__ = "purchase_items"

    id = Column(Integer, primary_key=True, index=True)
    purchase_id = Column(Integer, ForeignKey("purchases.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True, index=True)  # nullable: never fall back to product_id=1 (SC4)
    product_name = Column(String(200))
    company_name = Column(String(200), nullable=True)
    trade_name = Column(String(200), nullable=True)
    unit = Column(String(30))
    batch_number = Column(String(100))
    expiry_date = Column(String(30))
    quantity = Column(Numeric(10, 3), nullable=False)
    purchase_price = Column(Numeric(12, 2), nullable=False)
    gst_rate = Column(Numeric(5, 2), default=0)
    total = Column(Numeric(14, 2), default=0)

    purchase = relationship("Purchase", back_populates="items")
    product = relationship("Product", back_populates="purchase_items")


class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shop_settings.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    transaction_type = Column(SAEnum(InventoryTxType), nullable=False)
    quantity = Column(Numeric(10, 3), nullable=False)
    previous_stock = Column(Numeric(12, 3), default=0)
    new_stock = Column(Numeric(12, 3), default=0)
    reference_id = Column(Integer)          # sale_id or purchase_id
    reference_type = Column(String(20))     # SALE | PURCHASE | MANUAL
    transaction_date = Column(DateTime, default=_utc_now, index=True)
    notes = Column(Text)

    product = relationship("Product", back_populates="inventory_transactions")


class GstTransaction(Base):
    __tablename__ = "gst_transactions"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shop_settings.id"), nullable=False, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=False, index=True)
    invoice_number = Column(String(50), nullable=False)
    taxable_amount = Column(Numeric(14, 2), default=0)
    gst_rate = Column(Numeric(5, 2), default=0)
    gst_amount = Column(Numeric(14, 2), default=0)
    transaction_date = Column(DateTime, default=_utc_now, index=True)

    sale = relationship("Sale", back_populates="gst_transactions")


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shop_settings.id"), nullable=False, index=True)
    expense_name = Column(String(200), nullable=False)
    category = Column(SAEnum(ExpenseCategory), default=ExpenseCategory.OTHER)
    amount = Column(Numeric(12, 2), nullable=False)
    expense_date = Column(Date, nullable=False, index=True)
    payment_mode = Column(String(30), default="Cash")
    description = Column(Text)
    created_at = Column(DateTime, default=_utc_now)
    created_by = Column(Integer, ForeignKey("users.id"))


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    shop_id = Column(Integer, ForeignKey("shop_settings.id"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(SAEnum(AuditAction), nullable=False)
    reference_id = Column(Integer)
    reference_type = Column(String(50))
    description = Column(Text)
    ip_address = Column(String(45))
    created_at = Column(DateTime, default=_utc_now, index=True)

    user = relationship("User", back_populates="audit_logs")


class SalesReturn(Base):
    __tablename__ = "sales_returns"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shop_settings.id"), nullable=False, index=True)
    return_number = Column(String(50), nullable=False, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id", ondelete="CASCADE"), nullable=False, index=True)
    invoice_number = Column(String(50), nullable=False, index=True)
    customer_name = Column(String(200))
    customer_phone = Column(String(20))
    refund_subtotal = Column(Numeric(14, 2), default=0)
    refund_gst_amount = Column(Numeric(14, 2), default=0)
    refund_grand_total = Column(Numeric(14, 2), default=0)
    refund_payment_method = Column(SAEnum(PaymentMethod), default=PaymentMethod.CASH)
    reason = Column(String(500))
    notes = Column(Text)
    return_date = Column(DateTime, default=_utc_now, index=True)
    created_at = Column(DateTime, default=_utc_now)
    created_by = Column(Integer, ForeignKey("users.id"))

    sale = relationship("Sale", back_populates="returns")
    items = relationship("SalesReturnItem", back_populates="sales_return", cascade="all, delete-orphan")
    creator = relationship("User")

    __table_args__ = (
        Index("uq_sales_return_shop_number", "shop_id", "return_number", unique=True),
    )


class SalesReturnItem(Base):
    __tablename__ = "sales_return_items"

    id = Column(Integer, primary_key=True, index=True)
    sales_return_id = Column(Integer, ForeignKey("sales_returns.id", ondelete="CASCADE"), nullable=False, index=True)
    sale_item_id = Column(Integer, ForeignKey("sale_items.id"), nullable=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    batch_id = Column(Integer, ForeignKey("product_batches.id", ondelete="SET NULL"), nullable=True)
    batch_number = Column(String(100), nullable=True)
    product_name = Column(String(200), nullable=False)
    company_name = Column(String(200))
    net_content = Column(String(50))
    returned_quantity = Column(Numeric(10, 3), nullable=False)
    unit_price = Column(Numeric(12, 2), nullable=False)
    cost_price = Column(Numeric(12, 2), nullable=True)  # Snapshot for COGS reversal (SD2)
    gst_rate = Column(Numeric(5, 2), default=0)
    refund_taxable = Column(Numeric(14, 2), default=0)
    refund_gst = Column(Numeric(14, 2), default=0)
    refund_total = Column(Numeric(14, 2), default=0)

    sales_return = relationship("SalesReturn", back_populates="items")
    product = relationship("Product")
    batch = relationship("ProductBatch")
    sale_item = relationship("SaleItem")


class PasswordResetCode(Base):
    """
    Persistent store for multi-worker serverless password resets.
    Ensures OTP verification survives across Lambda container recycles and cold starts.
    """
    __tablename__ = "password_reset_codes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    username = Column(String(50), nullable=False, index=True)
    code_hash = Column(String(128), nullable=False)
    reset_secret = Column(String(128), nullable=True)
    verified_token = Column(String(128), nullable=True, index=True)
    verified = Column(Boolean, default=False)
    verified_at = Column(DateTime, nullable=True)
    attempts = Column(Integer, default=0)
    reset_attempts = Column(Integer, default=0)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=_utc_now)

    user = relationship("User")


class UsedCaptchaNonce(Base):
    """Consumed CAPTCHA nonces. Shared by every Lambda worker so a solved CAPTCHA cannot be replayed."""
    __tablename__ = "used_captcha_nonces"

    nonce = Column(String(64), primary_key=True)
    expires_at = Column(DateTime, nullable=False, index=True)


class RateLimitEvent(Base):
    """One row per throttled action (login, register, OTP...) keyed by bucket, e.g. ``login:ip:1.2.3.4``."""
    __tablename__ = "rate_limit_events"

    id = Column(Integer, primary_key=True, index=True)
    bucket = Column(String(200), nullable=False, index=True)
    created_at = Column(DateTime, default=_utc_now, nullable=False, index=True)

    __table_args__ = (
        Index("ix_rate_limit_bucket_created", "bucket", "created_at"),
    )


class KhataPayment(Base):
    """
    Tenant-scoped Customer Udhar (Credit) repayments and Supplier Payable settlements.
    ledger_type: 'CUSTOMER' (repayment against CREDIT sales) or 'SUPPLIER' (payout against purchase bills).
    """
    __tablename__ = "khata_payments"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shop_settings.id"), nullable=False, index=True)
    ledger_type = Column(String(20), nullable=False, default="CUSTOMER", index=True)
    party_name = Column(String(200), nullable=False, index=True)
    party_phone = Column(String(20), nullable=True, index=True)
    party_gstin = Column(String(20), nullable=True)
    reference_id = Column(Integer, nullable=True)
    reference_number = Column(String(100), nullable=True)
    amount = Column(Numeric(14, 2), nullable=False, default=0)
    payment_mode = Column(String(30), nullable=False, default="CASH")
    notes = Column(String(300), nullable=True)
    recorded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=_utc_now, nullable=False, index=True)

    __table_args__ = (
        Index("ix_khata_shop_ledger_phone", "shop_id", "ledger_type", "party_phone"),
    )


class MarketingCampaign(Base):
    """
    Tenant-scoped seasonal WhatsApp broadcast marketing campaigns.
    Tracks farmer segmentation, localized campaign templates, and dispatch status.
    """
    __tablename__ = "marketing_campaigns"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shop_settings.id"), nullable=False, index=True)
    campaign_name = Column(String(200), nullable=False)
    season = Column(String(50), default="KHARIF", nullable=False, index=True)  # KHARIF, RABI, ZAID, GENERAL
    target_crop = Column(String(100), nullable=True)
    target_village = Column(String(100), nullable=True)
    template_text = Column(Text, nullable=False)
    total_recipients = Column(Integer, default=0, nullable=False)
    sent_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=_utc_now, nullable=False, index=True)

    __table_args__ = (
        Index("ix_campaign_shop_season", "shop_id", "season"),
    )

