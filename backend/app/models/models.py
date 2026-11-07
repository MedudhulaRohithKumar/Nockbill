import enum
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Date,
    Text, ForeignKey, Enum as SAEnum, Numeric, BigInteger, Index
)
from sqlalchemy.orm import relationship
from app.database.base import Base


# ─── Enumerations ────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    OWNER = "OWNER"
    STAFF = "STAFF"


class UnitType(str, enum.Enum):
    ML = "ml"
    LITER = "liter"
    LITRES = "Litres"
    GRAM = "gram"
    KG = "kg"
    BAGS = "Bags"
    PACKETS = "Packets"
    BOTTLES = "Bottles"
    PCS = "pcs"


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
    shop_id = Column(Integer, ForeignKey("shop_settings.id"), default=1, nullable=True, index=True)
    subscription_status = Column(String(20), default="ACTIVE")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

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
    logo_path = Column(String(500))
    default_gst_rate = Column(Numeric(5, 2), default=18)
    currency = Column(String(5), default="INR")
    thermal_print = Column(Boolean, default=False)
    terms_conditions = Column(Text)
    subscription_status = Column(String(20), default="ACTIVE")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PriceList(Base):
    __tablename__ = "price_lists"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shop_settings.id"), default=1, nullable=False, index=True)
    name = Column(String(150), nullable=False, index=True)
    description = Column(String(500), nullable=True)
    adjustment_type = Column(String(20), nullable=False, default="DISCOUNT")   # "DISCOUNT" or "INCREMENT"
    calculation_mode = Column(String(20), nullable=False, default="PERCENTAGE") # "PERCENTAGE" or "FIXED"
    adjustment_value = Column(Numeric(12, 2), nullable=False, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    products = relationship("Product", back_populates="price_list")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shop_settings.id"), default=1, nullable=False, index=True)
    product_code = Column(String(50), index=True)
    product_name = Column(String(200), nullable=False, index=True)
    company_name = Column(String(200), index=True)
    trade_name = Column(String(200), index=True, nullable=True)
    category = Column(String(100), default="Fertilizer", index=True)
    batch_number = Column(String(100), nullable=True, index=True)
    net_content = Column(Numeric(10, 3))
    unit = Column(SAEnum(UnitType), default=UnitType.ML)
    purchase_price = Column(Numeric(12, 2), default=0)
    base_selling_price = Column(Numeric(12, 2), nullable=True)
    selling_price = Column(Numeric(12, 2), nullable=False)
    price_list_id = Column(Integer, ForeignKey("price_lists.id", ondelete="SET NULL"), nullable=True, index=True)
    gst_rate = Column(Numeric(5, 2), default=18)
    manufacture_date = Column(String(10))   # stored as YYYY-MM
    expiry_date = Column(String(10))        # stored as YYYY-MM
    current_stock = Column(Numeric(12, 3), default=0)
    minimum_stock = Column(Numeric(12, 3), default=5)
    barcode = Column(String(100), unique=True, index=True, nullable=True)
    hsn_code = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

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
    )


class ProductBatch(Base):
    __tablename__ = "product_batches"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    batch_number = Column(String(100), nullable=False, index=True)
    trade_name = Column(String(200), nullable=True, index=True)
    company_name = Column(String(200), nullable=True)
    manufacture_date = Column(String(10))   # YYYY-MM
    expiry_date = Column(String(10), nullable=False, index=True)        # YYYY-MM
    purchase_price = Column(Numeric(12, 2), default=0)
    selling_price = Column(Numeric(12, 2), nullable=False)
    mrp = Column(Numeric(12, 2), nullable=True)
    current_stock = Column(Numeric(12, 3), default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

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
    created_at = Column(DateTime, default=datetime.utcnow)

    product = relationship("Product", back_populates="variants")


class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shop_settings.id"), default=1, nullable=False, index=True)
    invoice_number = Column(String(50), nullable=False, index=True)
    idempotency_key = Column(String(100), unique=True)  # duplicate prevention
    customer_name = Column(String(200))
    customer_phone = Column(String(20))
    subtotal = Column(Numeric(14, 2), default=0)
    gst_amount = Column(Numeric(14, 2), default=0)
    grand_total = Column(Numeric(14, 2), default=0)
    payment_method = Column(SAEnum(PaymentMethod), default=PaymentMethod.CASH)
    notes = Column(Text)
    sale_date = Column(DateTime, default=datetime.utcnow, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(Integer, ForeignKey("users.id"))

    items = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan")
    returns = relationship("SalesReturn", back_populates="sale", cascade="all, delete-orphan")
    gst_transactions = relationship("GstTransaction", back_populates="sale")

    __table_args__ = (
        Index("ix_sale_shop_date", "shop_id", "sale_date"),
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
    net_content = Column(String(50))
    quantity = Column(Numeric(10, 3), nullable=False)
    price = Column(Numeric(12, 2), nullable=False)      # per unit selling price
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
    shop_id = Column(Integer, ForeignKey("shop_settings.id"), default=1, nullable=False, index=True)
    supplier_name = Column(String(200))
    invoice_number = Column(String(100))
    purchase_date = Column(DateTime, default=datetime.utcnow, index=True)
    subtotal = Column(Numeric(14, 2), default=0)
    gst_amount = Column(Numeric(14, 2), default=0)
    grand_total = Column(Numeric(14, 2), default=0)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(Integer, ForeignKey("users.id"))

    items = relationship("PurchaseItem", back_populates="purchase", cascade="all, delete-orphan")


class PurchaseItem(Base):
    __tablename__ = "purchase_items"

    id = Column(Integer, primary_key=True, index=True)
    purchase_id = Column(Integer, ForeignKey("purchases.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
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
    shop_id = Column(Integer, ForeignKey("shop_settings.id"), default=1, nullable=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    transaction_type = Column(SAEnum(InventoryTxType), nullable=False)
    quantity = Column(Numeric(10, 3), nullable=False)
    previous_stock = Column(Numeric(12, 3), default=0)
    new_stock = Column(Numeric(12, 3), default=0)
    reference_id = Column(Integer)          # sale_id or purchase_id
    reference_type = Column(String(20))     # SALE | PURCHASE | MANUAL
    transaction_date = Column(DateTime, default=datetime.utcnow, index=True)
    notes = Column(Text)

    product = relationship("Product", back_populates="inventory_transactions")


class GstTransaction(Base):
    __tablename__ = "gst_transactions"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shop_settings.id"), default=1, nullable=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=False, index=True)
    invoice_number = Column(String(50), nullable=False)
    taxable_amount = Column(Numeric(14, 2), default=0)
    gst_rate = Column(Numeric(5, 2), default=0)
    gst_amount = Column(Numeric(14, 2), default=0)
    transaction_date = Column(DateTime, default=datetime.utcnow, index=True)

    sale = relationship("Sale", back_populates="gst_transactions")


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shop_settings.id"), default=1, nullable=False, index=True)
    expense_name = Column(String(200), nullable=False)
    category = Column(SAEnum(ExpenseCategory), default=ExpenseCategory.OTHER)
    amount = Column(Numeric(12, 2), nullable=False)
    expense_date = Column(Date, nullable=False, index=True)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(Integer, ForeignKey("users.id"))


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(SAEnum(AuditAction), nullable=False)
    reference_id = Column(Integer)
    reference_type = Column(String(50))
    description = Column(Text)
    ip_address = Column(String(45))
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User", back_populates="audit_logs")


class SalesReturn(Base):
    __tablename__ = "sales_returns"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shop_settings.id"), default=1, nullable=False, index=True)
    return_number = Column(String(50), unique=True, nullable=False, index=True)
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
    return_date = Column(DateTime, default=datetime.utcnow, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(Integer, ForeignKey("users.id"))

    sale = relationship("Sale", back_populates="returns")
    items = relationship("SalesReturnItem", back_populates="sales_return", cascade="all, delete-orphan")
    creator = relationship("User")


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
    gst_rate = Column(Numeric(5, 2), default=0)
    refund_taxable = Column(Numeric(14, 2), default=0)
    refund_gst = Column(Numeric(14, 2), default=0)
    refund_total = Column(Numeric(14, 2), default=0)

    sales_return = relationship("SalesReturn", back_populates="items")
    product = relationship("Product")
    batch = relationship("ProductBatch")
    sale_item = relationship("SaleItem")


def _ensure_schema_columns():
    """Ensure new tables and columns exist even when legacy seed.py runs before main.py."""
    try:
        from sqlalchemy import inspect, text
        from app.database.base import engine
        Base.metadata.create_all(bind=engine)
        inspector = inspect(engine)
        existing_tables = set(inspector.get_table_names())
        column_migrations = [
            ("products", "trade_name", "VARCHAR(200)"),
            ("products", "category", "VARCHAR(100) DEFAULT 'Fertilizer'"),
            ("products", "batch_number", "VARCHAR(100)"),
            ("products", "base_selling_price", "NUMERIC(12, 2)"),
            ("products", "price_list_id", "INTEGER"),
            ("product_batches", "trade_name", "VARCHAR(200)"),
            ("product_batches", "company_name", "VARCHAR(200)"),
            ("sale_items", "trade_name", "VARCHAR(200)"),
            ("purchase_items", "company_name", "VARCHAR(200)"),
            ("purchase_items", "trade_name", "VARCHAR(200)"),
        ]
        with engine.begin() as conn:
            for table_name, col_name, col_type in column_migrations:
                if table_name in existing_tables:
                    cols = {c["name"] for c in inspector.get_columns(table_name)}
                    if col_name not in cols:
                        conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type}"))
    except Exception:
        pass


_ensure_schema_columns()
