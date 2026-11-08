"""
Seed script: Creates default owner, shop settings, 10 products,
sample purchases, sales, and expenses.

Run: python seed.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from datetime import datetime, date, timedelta
from decimal import Decimal
from sqlalchemy import inspect, text
from app.database.base import SessionLocal, engine, Base
from app.models.models import (
    User, UserRole, ShopSettings, Product, UnitType,
    Sale, SaleItem, PaymentMethod,
    Purchase, PurchaseItem,
    InventoryTransaction, InventoryTxType,
    GstTransaction, Expense, ExpenseCategory,
)
from app.utils.auth import hash_password


def _run_schema_migrations(db_engine):
    try:
        inspector = inspect(db_engine)
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
        with db_engine.begin() as conn:
            for table_name, col_name, col_type in column_migrations:
                if table_name in existing_tables:
                    cols = {c["name"] for c in inspector.get_columns(table_name)}
                    if col_name not in cols:
                        conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type}"))
    except Exception as e:
        print(f"Migration error in seed: {e}")


def seed():
    Base.metadata.create_all(bind=engine)
    _run_schema_migrations(engine)
    db = SessionLocal()

    seed_demo_enabled = os.environ.get("SEED_DEMO_DATA", "false").strip().lower() in ("true", "1", "yes")
    admin_password = (os.environ.get("SEED_ADMIN_PASSWORD") or "").strip()

    if not seed_demo_enabled:
        print("SEED_DEMO_DATA=false. Database schema tables verified. Skipping demo account and sample data creation.")
        db.close()
        return

    if not admin_password or len(admin_password) < 8 or admin_password == "admin123":
        print("SEED_DEMO_DATA is true but valid SEED_ADMIN_PASSWORD (min 8 chars, non-default) was not supplied. Skipping demo account creation.")
        db.close()
        return

    try:
        # ── Shop settings ────────────────────────────────────────
        shop = db.query(ShopSettings).first()
        if not shop:
            shop = ShopSettings(
                shop_name="Green Field Agro Store",
                address="123, Main Market Road",
                city="Hyderabad",
                state="Telangana",
                pincode="500001",
                phone="9876543210",
                email="greenfield@example.com",
                gstin="36AABCU9603R1ZX",
                invoice_prefix="GFA",
                default_gst_rate=Decimal("18"),
            )
            db.add(shop)
            db.flush()
            print("Created demo shop settings")

        # ── Owner user (opt-in demo only) ────────────────────────
        if not db.query(User).filter(User.username == "demo_admin").first():
            owner = User(
                name="Demo Shop Owner",
                username="demo_admin",
                password_hash=hash_password(admin_password),
                role=UserRole.OWNER,
                shop_id=shop.id,
            )
            db.add(owner)
            db.flush()
            print("Created demo admin user (username: demo_admin).")

        db.commit()

        # ── Products ─────────────────────────────────────────────
        products_data = [
            {"product_code": "PRD00001", "product_name": "Urea Fertilizer", "company_name": "IFFCO Ltd", "net_content": Decimal("50"), "unit": UnitType.KG, "purchase_price": Decimal("250"), "selling_price": Decimal("320"), "gst_rate": Decimal("5"), "manufacture_date": "2026-03", "expiry_date": "2028-03", "current_stock": Decimal("200"), "minimum_stock": Decimal("20")},
            {"product_code": "PRD00002", "product_name": "DAP Fertilizer", "company_name": "Coromandel International", "net_content": Decimal("50"), "unit": UnitType.KG, "purchase_price": Decimal("1100"), "selling_price": Decimal("1400"), "gst_rate": Decimal("5"), "manufacture_date": "2026-04", "expiry_date": "2028-04", "current_stock": Decimal("150"), "minimum_stock": Decimal("15")},
            {"product_code": "PRD00003", "product_name": "NPK 10-26-26", "company_name": "Zuari Agro Chemicals", "net_content": Decimal("50"), "unit": UnitType.KG, "purchase_price": Decimal("900"), "selling_price": Decimal("1150"), "gst_rate": Decimal("5"), "manufacture_date": "2026-05", "expiry_date": "2028-05", "current_stock": Decimal("100"), "minimum_stock": Decimal("10")},
            {"product_code": "PRD00004", "product_name": "Chlorpyrifos 20% EC", "company_name": "Bayer CropScience", "net_content": Decimal("500"), "unit": UnitType.ML, "purchase_price": Decimal("280"), "selling_price": Decimal("380"), "gst_rate": Decimal("18"), "manufacture_date": "2026-01", "expiry_date": "2028-01", "current_stock": Decimal("80"), "minimum_stock": Decimal("10")},
            {"product_code": "PRD00005", "product_name": "Imidacloprid 17.8% SL", "company_name": "Syngenta India", "net_content": Decimal("250"), "unit": UnitType.ML, "purchase_price": Decimal("320"), "selling_price": Decimal("450"), "gst_rate": Decimal("18"), "manufacture_date": "2026-02", "expiry_date": "2028-02", "current_stock": Decimal("60"), "minimum_stock": Decimal("8")},
            {"product_code": "PRD00006", "product_name": "Cypermethrin 10% EC", "company_name": "Gharda Chemicals", "net_content": Decimal("100"), "unit": UnitType.ML, "purchase_price": Decimal("90"), "selling_price": Decimal("130"), "gst_rate": Decimal("18"), "manufacture_date": "2026-03", "expiry_date": "2028-03", "current_stock": Decimal("120"), "minimum_stock": Decimal("15")},
            {"product_code": "PRD00007", "product_name": "Mancozeb 75% WP", "company_name": "UPL Limited", "net_content": Decimal("500"), "unit": UnitType.GRAM, "purchase_price": Decimal("180"), "selling_price": Decimal("250"), "gst_rate": Decimal("18"), "manufacture_date": "2026-04", "expiry_date": "2028-04", "current_stock": Decimal("90"), "minimum_stock": Decimal("10")},
            {"product_code": "PRD00008", "product_name": "Thiamethoxam 25% WG", "company_name": "Syngenta India", "net_content": Decimal("100"), "unit": UnitType.GRAM, "purchase_price": Decimal("420"), "selling_price": Decimal("580"), "gst_rate": Decimal("18"), "manufacture_date": "2026-05", "expiry_date": "2026-11", "current_stock": Decimal("4"), "minimum_stock": Decimal("5")},  # Expiring soon + Low stock
            {"product_code": "PRD00009", "product_name": "Potassium Humate", "company_name": "Hifield-Agri Ltd", "net_content": Decimal("1"), "unit": UnitType.KG, "purchase_price": Decimal("550"), "selling_price": Decimal("750"), "gst_rate": Decimal("18"), "manufacture_date": "2025-12", "expiry_date": "2027-12", "current_stock": Decimal("50"), "minimum_stock": Decimal("5")},
            {"product_code": "PRD00010", "product_name": "Bio NPK (Liquid)", "company_name": "Biofix Agri Sciences", "net_content": Decimal("1"), "unit": UnitType.LITER, "purchase_price": Decimal("280"), "selling_price": Decimal("400"), "gst_rate": Decimal("18"), "manufacture_date": "2026-06", "expiry_date": "2028-06", "current_stock": Decimal("0"), "minimum_stock": Decimal("5")},  # Out of stock
        ]

        product_objs = []
        for p in products_data:
            if not db.query(Product).filter(Product.product_code == p["product_code"]).first():
                product = Product(**p)
                db.add(product)
                product_objs.append(product)

        db.commit()
        print(f"Created {len(product_objs)} products")

        # Reload products
        all_products = db.query(Product).filter(Product.is_active == True).all()
        if len(all_products) < 2:
            print("Skipping sample transactions (products missing)")
            return

        p1, p2, p3, p4 = all_products[0], all_products[1], all_products[2], all_products[3]

        # ── Sample sale ──────────────────────────────────────────
        shop = db.query(ShopSettings).first()
        owner = db.query(User).filter(User.username == "admin").first()

        if db.query(Sale).count() == 0:
            sale_date = datetime.utcnow() - timedelta(days=1)
            invoice_number = f"GFA-{sale_date.strftime('%Y%m')}-00001"
            shop.invoice_counter = 2

            sale = Sale(
                invoice_number=invoice_number,
                customer_name="Ramesh Kumar",
                customer_phone="9900112233",
                payment_method=PaymentMethod.CASH,
                sale_date=sale_date,
                created_by=owner.id,
            )
            db.add(sale)
            db.flush()

            subtotal = Decimal("0")
            total_gst = Decimal("0")
            gst_buckets = {}

            items = [
                (p1, Decimal("2"), p1.selling_price, p1.gst_rate),
                (p4, Decimal("1"), p4.selling_price, p4.gst_rate),
            ]
            for product, qty, price, gst_rate in items:
                taxable = qty * price
                gst_amount = (taxable * gst_rate / 100).quantize(Decimal("0.01"))
                total = taxable + gst_amount
                subtotal += taxable
                total_gst += gst_amount

                db.add(SaleItem(
                    sale_id=sale.id, product_id=product.id,
                    product_name=product.product_name, company_name=product.company_name,
                    net_content=f"{product.net_content} {product.unit.value}",
                    quantity=qty, price=price, gst_rate=gst_rate,
                    gst_amount=gst_amount, total=total,
                    expiry_date=product.expiry_date,
                ))

                # Inventory transaction
                prev_stock = product.current_stock
                product.current_stock -= qty
                db.add(InventoryTransaction(
                    product_id=product.id, transaction_type=InventoryTxType.SALE,
                    quantity=qty, previous_stock=prev_stock,
                    new_stock=product.current_stock, reference_id=sale.id,
                    reference_type="SALE",
                ))

                rate = gst_rate
                if rate not in gst_buckets:
                    gst_buckets[rate] = {"taxable": Decimal("0"), "gst": Decimal("0")}
                gst_buckets[rate]["taxable"] += taxable
                gst_buckets[rate]["gst"] += gst_amount

            sale.subtotal = subtotal.quantize(Decimal("0.01"))
            sale.gst_amount = total_gst.quantize(Decimal("0.01"))
            sale.grand_total = (subtotal + total_gst).quantize(Decimal("0.01"))

            for rate, bucket in gst_buckets.items():
                db.add(GstTransaction(
                    sale_id=sale.id, invoice_number=invoice_number,
                    taxable_amount=bucket["taxable"], gst_rate=rate,
                    gst_amount=bucket["gst"], transaction_date=sale_date,
                ))

            db.commit()
            print(f"Created sample sale: {invoice_number}")

        # ── Sample expenses ───────────────────────────────────────
        if db.query(Expense).count() == 0:
            expenses = [
                Expense(expense_name="Shop Rent", category=ExpenseCategory.RENT, amount=Decimal("8000"), expense_date=date(2026, 9, 1), created_by=owner.id),
                Expense(expense_name="Electricity Bill", category=ExpenseCategory.ELECTRICITY, amount=Decimal("1500"), expense_date=date(2026, 9, 1), created_by=owner.id),
                Expense(expense_name="Staff Salary", category=ExpenseCategory.SALARY, amount=Decimal("12000"), expense_date=date(2026, 9, 1), created_by=owner.id),
            ]
            for exp in expenses:
                db.add(exp)
            db.commit()
            print("Created sample expenses")

    finally:
        db.close()
        print("Seeding complete!")


if __name__ == "__main__":
    seed()
