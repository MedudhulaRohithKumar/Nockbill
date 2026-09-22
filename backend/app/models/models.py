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
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    audit_logs = relationship("AuditLog", back_populates="user")


class ShopSettings(Base):
    __tablename__ = "shop_settings"

    id = Column(Integer, primary_key=True, index=True)
    shop_name = Column(String(200), nullable=False, default="My Fertilizer Shop")
    address = Column(Text)
    city = Column(String(100))
    state = Column(String(100))
    pincode = Column(String(10))
    phone = Column(String(20))
    email = Column(String(150))
    gstin = Column(String(20))
    invoice_prefix = Column(String(10), default="INV")
    invoice_counter = Column(Integer, default=1)
    logo_path = Column(String(500))
    default_gst_rate = Column(Numeric(5, 2), default=18)
    currency = Column(String(5), default="INR")
    thermal_print = Column(Boolean, default=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    product_code = Column(String(50), unique=True, index=True)
    product_name = Column(String(200), nullable=False, index=True)
    company_name = Column(String(200), index=True)
    net_content = Column(Numeric(10, 3))
    unit = Column(SAEnum(UnitType), default=UnitType.ML)
    purchase_price = Column(Numeric(12, 2), default=0)
    selling_price = Column(Numeric(12, 2), nullable=False)
    gst_rate = Column(Numeric(5, 2), default=18)
    manufacture_date = Column(String(10))   # stored as YYYY-MM
    expiry_date = Column(String(10))        # stored as YYYY-MM
    current_stock = Column(Numeric(12, 3), default=0)
    minimum_stock = Column(Numeric(12, 3), default=5)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    sale_items = relationship("SaleItem", back_populates="product")
    purchase_items = relationship("PurchaseItem", back_populates="product")
    inventory_transactions = relationship("InventoryTransaction", back_populates="product")

    __table_args__ = (
        Index("ix_product_name_company", "product_name", "company_name"),
    )


class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(50), unique=True, nullable=False, index=True)
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
    gst_transactions = relationship("GstTransaction", back_populates="sale")


class SaleItem(Base):
    __tablename__ = "sale_items"

    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)  # nullable: product may be deleted
    # Snapshot of product at time of sale
    product_name = Column(String(200), nullable=False)
    company_name = Column(String(200))
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


class Purchase(Base):
    __tablename__ = "purchases"

    id = Column(Integer, primary_key=True, index=True)
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
    purchase_id = Column(Integer, ForeignKey("purchases.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Numeric(10, 3), nullable=False)
    purchase_price = Column(Numeric(12, 2), nullable=False)
    gst_rate = Column(Numeric(5, 2), default=0)
    total = Column(Numeric(14, 2), default=0)

    purchase = relationship("Purchase", back_populates="items")
    product = relationship("Product", back_populates="purchase_items")


class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"

    id = Column(Integer, primary_key=True, index=True)
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
