"""Explicit, idempotent schema bootstrap/migration.

This used to run on every FastAPI import (i.e. every Lambda cold start), taking table locks and
adding seconds to cold starts. It now runs:

* automatically at import ONLY when ``AUTO_MIGRATE_ON_STARTUP=true`` (local development default), or
* as a deployment step: ``python -m app.database.migrations`` or the Lambda ``migrate_and_seed`` action.

On PostgreSQL a transaction-scoped advisory lock serialises concurrent runners so simultaneous
cold starts can never deadlock on DDL.
"""
import logging
from typing import List, Tuple

from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection, Engine

logger = logging.getLogger(__name__)

_MIGRATION_LOCK_KEY = 727_274_001

COLUMN_MIGRATIONS: List[Tuple[str, str, str]] = [
    ("users", "email", "VARCHAR(150)"),
    ("users", "phone", "VARCHAR(20)"),
    ("users", "shop_id", "INTEGER"),
    ("users", "subscription_status", "VARCHAR(20) DEFAULT 'ACTIVE'"),
    ("users", "google_sub", "VARCHAR(64)"),
    ("users", "token_version", "INTEGER DEFAULT 1"),
    ("shop_settings", "proprietor_name", "VARCHAR(200)"),
    ("shop_settings", "address_line1", "VARCHAR(500)"),
    ("shop_settings", "address_line2", "VARCHAR(500)"),
    ("shop_settings", "fertilizer_license_no", "VARCHAR(100)"),
    ("shop_settings", "pesticide_license_no", "VARCHAR(100)"),
    ("shop_settings", "seed_license_no", "VARCHAR(100)"),
    ("shop_settings", "bank_name", "VARCHAR(200)"),
    ("shop_settings", "bank_account_no", "VARCHAR(50)"),
    ("shop_settings", "bank_ifsc", "VARCHAR(20)"),
    ("shop_settings", "bank_branch", "VARCHAR(200)"),
    ("shop_settings", "upi_id", "VARCHAR(100)"),
    ("shop_settings", "terms_conditions", "TEXT"),
    ("shop_settings", "invoice_template", "VARCHAR(40) DEFAULT 'CLASSIC_GST'"),
    ("shop_settings", "invoice_accent_color", "VARCHAR(20) DEFAULT '#15803d'"),
    ("shop_settings", "invoice_header_tagline", "VARCHAR(250)"),
    ("shop_settings", "invoice_footer_note", "VARCHAR(300)"),
    ("shop_settings", "invoice_signature_label", "VARCHAR(120) DEFAULT 'Authorized Signatory'"),
    ("shop_settings", "invoice_show_logo", "BOOLEAN DEFAULT TRUE"),
    ("shop_settings", "invoice_show_licenses", "BOOLEAN DEFAULT TRUE"),
    ("shop_settings", "invoice_show_bank_details", "BOOLEAN DEFAULT TRUE"),
    ("shop_settings", "invoice_show_batch_expiry", "BOOLEAN DEFAULT TRUE"),
    ("shop_settings", "invoice_show_hsn", "BOOLEAN DEFAULT TRUE"),
    ("shop_settings", "subscription_status", "VARCHAR(20) DEFAULT 'ACTIVE'"),
    ("products", "trade_name", "VARCHAR(200)"),
    ("products", "category", "VARCHAR(100) DEFAULT 'Fertilizer'"),
    ("products", "batch_number", "VARCHAR(100)"),
    ("products", "base_selling_price", "NUMERIC(12, 2)"),
    ("products", "price_list_id", "INTEGER"),
    ("products", "category_attributes", "TEXT"),
    ("product_batches", "trade_name", "VARCHAR(200)"),
    ("product_batches", "company_name", "VARCHAR(200)"),
    ("sales", "customer_address", "VARCHAR(300)"),
    ("sales", "customer_aadhar", "VARCHAR(20)"),
    ("sales", "customer_gstin", "VARCHAR(20)"),
    ("sales", "is_interstate", "BOOLEAN DEFAULT FALSE"),
    ("sales", "total_discount", "NUMERIC(14, 2) DEFAULT 0"),
    ("sales", "total_igst", "NUMERIC(14, 2) DEFAULT 0"),
    ("sales", "round_off", "NUMERIC(8, 2) DEFAULT 0"),
    ("sale_items", "trade_name", "VARCHAR(200)"),
    ("sale_items", "hsn_code", "VARCHAR(50)"),
    ("sale_items", "unit", "VARCHAR(30)"),
    ("sale_items", "mrp", "NUMERIC(12, 2)"),
    ("sale_items", "discount_percent", "NUMERIC(5, 2) DEFAULT 0"),
    ("sale_items", "discount_amount", "NUMERIC(14, 2) DEFAULT 0"),
    ("sale_items", "cost_price", "NUMERIC(12, 2)"),
    ("purchases", "supplier_gstin", "VARCHAR(20)"),
    ("purchase_items", "company_name", "VARCHAR(200)"),
    ("purchase_items", "trade_name", "VARCHAR(200)"),
    ("expenses", "payment_mode", "VARCHAR(30) DEFAULT 'Cash'"),
    ("audit_logs", "shop_id", "INTEGER"),
    ("sales_return_items", "cost_price", "NUMERIC(12, 2)"),
]

INDEX_STATEMENTS = [
    "CREATE INDEX IF NOT EXISTS ix_product_shop_active ON products (shop_id, is_active)",
    "CREATE INDEX IF NOT EXISTS ix_product_shop_trade ON products (shop_id, trade_name)",
    "CREATE INDEX IF NOT EXISTS ix_product_shop_category ON products (shop_id, category)",
    "CREATE INDEX IF NOT EXISTS ix_sale_shop_date ON sales (shop_id, sale_date)",
    "CREATE UNIQUE INDEX IF NOT EXISTS uq_sale_shop_invoice ON sales (shop_id, invoice_number)",
    "CREATE UNIQUE INDEX IF NOT EXISTS uq_sale_shop_idempotency ON sales (shop_id, idempotency_key)",
    "CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_return_shop_number ON sales_returns (shop_id, return_number)",
    "CREATE INDEX IF NOT EXISTS ix_sale_items_sale_id ON sale_items (sale_id)",
    "CREATE INDEX IF NOT EXISTS ix_purchase_items_purchase_id ON purchase_items (purchase_id)",
    "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_google_sub ON users (google_sub)",
    "CREATE UNIQUE INDEX IF NOT EXISTS uq_product_shop_barcode ON products (shop_id, barcode)",
    "CREATE INDEX IF NOT EXISTS ix_audit_logs_shop_id ON audit_logs (shop_id)",
    "CREATE INDEX IF NOT EXISTS ix_rate_limit_bucket_created ON rate_limit_events (bucket, created_at)",
    "CREATE INDEX IF NOT EXISTS ix_khata_shop_ledger_phone ON khata_payments (shop_id, ledger_type, party_phone)",
]

_CATEGORY_BACKFILL_SQL = """
UPDATE products
SET category = CASE
    WHEN LOWER(product_name) LIKE '%seed%' THEN 'Seeds'
    WHEN LOWER(product_name) LIKE '%imidacloprid%'
      OR LOWER(product_name) LIKE '%chlorpyrifos%'
      OR LOWER(product_name) LIKE '%cypermethrin%'
      OR LOWER(product_name) LIKE '%mancozeb%'
      OR LOWER(product_name) LIKE '%glyphosate%'
      OR LOWER(product_name) LIKE '%pesticide%'
      OR LOWER(product_name) LIKE '%insecticide%'
      OR LOWER(product_name) LIKE '%fungicide%'
      OR LOWER(product_name) LIKE '%herbicide%' THEN 'Pesticide'
    WHEN LOWER(product_name) LIKE '%zinc%'
      OR LOWER(product_name) LIKE '%boron%'
      OR LOWER(product_name) LIKE '%micronutrient%'
      OR LOWER(product_name) LIKE '%chelated%' THEN 'Micronutrients'
    WHEN LOWER(product_name) LIKE '%bio%'
      OR LOWER(product_name) LIKE '%rhizobium%'
      OR LOWER(product_name) LIKE '%azotobacter%' THEN 'Bio-Fertilizer'
    WHEN LOWER(product_name) LIKE '%organic%'
      OR LOWER(product_name) LIKE '%vermi%'
      OR LOWER(product_name) LIKE '%compost%' THEN 'Organic'
    ELSE 'Fertilizer'
END
WHERE category IS NULL OR category = '' OR category = company_name
"""

_UNIT_NORMALIZE_CASE = """CASE UPPER(TRIM(unit))
    WHEN 'ML' THEN 'ml'
    WHEN 'LITER' THEN 'Litre'
    WHEN 'LITRES' THEN 'Litre'
    WHEN 'LITRE' THEN 'Litre'
    WHEN 'GRAM' THEN 'Grams'
    WHEN 'GRAMS' THEN 'Grams'
    WHEN 'KG' THEN 'Kg'
    WHEN 'BAGS' THEN 'Bags'
    WHEN 'PACKETS' THEN 'Packets'
    WHEN 'POUCHES' THEN 'Pouches'
    WHEN 'TONS' THEN 'Tons'
    WHEN 'BOTTLES' THEN 'Bottles'
    WHEN 'PCS' THEN 'Pieces'
    WHEN 'PIECES' THEN 'Pieces'
    ELSE unit
END"""


def _add_missing_columns(conn: Connection) -> None:
    inspector = inspect(conn)
    existing_tables = set(inspector.get_table_names())
    columns_cache = {}
    for table_name, col_name, col_type in COLUMN_MIGRATIONS:
        if table_name not in existing_tables:
            continue
        if table_name not in columns_cache:
            columns_cache[table_name] = {c["name"] for c in inspector.get_columns(table_name)}
        if col_name not in columns_cache[table_name]:
            conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type}"))
            columns_cache[table_name].add(col_name)


def _exec_savepoint(conn: Connection, sql: str) -> None:
    """Execute optional DDL inside a SAVEPOINT so a benign failure never aborts a PostgreSQL transaction."""
    try:
        with conn.begin_nested():
            conn.execute(text(sql))
    except Exception as exc:
        logger.debug("Optional migration statement skipped (%s): %s", sql, exc)


def _extend_postgres_enums(engine: Engine) -> None:
    """Extend existing PostgreSQL enum types using AUTOCOMMIT outside explicit transaction blocks."""
    if engine.dialect.name != "postgresql":
        return
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as ac_conn:
        exists = ac_conn.execute(
            text("SELECT 1 FROM pg_type WHERE typname = 'expensecategory'")
        ).scalar()
        if exists:
            for enum_val in ("PACKAGING", "OFFICE"):
                ac_conn.execute(
                    text(f"ALTER TYPE expensecategory ADD VALUE IF NOT EXISTS '{enum_val}'")
                )


def _drop_legacy_global_unique_indexes(conn: Connection, dialect: str) -> None:
    """Replace legacy table-wide UNIQUE constraints/indexes with per-shop composite unique indexes."""
    inspector = inspect(conn)
    existing_tables = set(inspector.get_table_names())

    # (table, legacy_index_name, column_for_plain_index, legacy_pg_constraint_name)
    legacy_targets = [
        ("products", "ix_products_barcode", "barcode", "products_barcode_key"),
        ("sales", "ix_sales_invoice_number", "invoice_number", "sales_invoice_number_key"),
        ("sales", "ix_sales_idempotency_key", "idempotency_key", "sales_idempotency_key_key"),
        ("sales_returns", "ix_sales_returns_return_number", "return_number", "sales_returns_return_number_key"),
    ]
    for table_name, idx_name, col_name, pg_constraint in legacy_targets:
        if table_name not in existing_tables:
            continue
        if dialect == "postgresql":
            _exec_savepoint(conn, f"ALTER TABLE {table_name} DROP CONSTRAINT IF EXISTS {pg_constraint}")
        for idx in inspector.get_indexes(table_name):
            if idx.get("name") == idx_name and idx.get("unique"):
                _exec_savepoint(conn, f"DROP INDEX {idx_name}")
                _exec_savepoint(conn, f"CREATE INDEX IF NOT EXISTS {idx_name} ON {table_name} ({col_name})")
                logger.info("Replaced table-wide UNIQUE index %s with plain index", idx_name)
                break


def _backfill_data(conn: Connection, dialect: str) -> None:
    inspector = inspect(conn)
    tables = set(inspector.get_table_names())
    if "users" in tables:
        conn.execute(text("UPDATE users SET token_version = 1 WHERE token_version IS NULL"))
    if dialect == "postgresql":
        # Each optional ALTER runs inside a SAVEPOINT so it can never poison the main transaction
        if "purchase_items" in tables:
            _exec_savepoint(conn, "ALTER TABLE purchase_items ALTER COLUMN product_id DROP NOT NULL")
        if "product_batches" in tables:
            _exec_savepoint(conn, "ALTER TABLE product_batches ALTER COLUMN expiry_date DROP NOT NULL")
        if "shop_settings" in tables:
            _exec_savepoint(conn, "ALTER TABLE shop_settings ALTER COLUMN logo_path TYPE TEXT")
    if "products" in tables:
        conn.execute(text(
            "UPDATE products SET base_selling_price = selling_price WHERE base_selling_price IS NULL"
        ))
        conn.execute(text(_CATEGORY_BACKFILL_SQL))
        conn.execute(text(
            "UPDATE products SET category = 'Bio-Fertilizer' WHERE LOWER(category) = 'bio-fertilizer' "
            "AND category <> 'Bio-Fertilizer'"
        ))
        if dialect == "postgresql":
            unit_type = conn.execute(text(
                "SELECT data_type FROM information_schema.columns "
                "WHERE table_name = 'products' AND column_name = 'unit'"
            )).scalar()
            if unit_type == "USER-DEFINED":
                conn.execute(text(
                    "ALTER TABLE products ALTER COLUMN unit TYPE VARCHAR(30) USING unit::text"
                ))
        # Only touch rows that actually change (never rewrite the whole table).
        conn.execute(text(
            f"UPDATE products SET unit = {_UNIT_NORMALIZE_CASE} "
            f"WHERE unit IS NOT NULL AND unit <> {_UNIT_NORMALIZE_CASE}"
        ))
    if "sale_items" in tables and "products" in tables:
        # One-time best-effort snapshot for legacy rows (new sales store cost_price at sale time).
        conn.execute(text(
            "UPDATE sale_items SET cost_price = ("
            "SELECT p.purchase_price FROM products p WHERE p.id = sale_items.product_id"
            ") WHERE cost_price IS NULL AND product_id IS NOT NULL"
        ))


def run_schema_migrations(engine: Engine) -> None:
    """Create missing tables/columns/indexes and apply data fixes. Safe to run repeatedly."""
    import app.models.models  # noqa: F401 - registers every table on Base.metadata
    from app.database.base import Base

    dialect = engine.dialect.name
    _extend_postgres_enums(engine)
    with engine.begin() as conn:
        if dialect == "postgresql":
            conn.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": _MIGRATION_LOCK_KEY})
        Base.metadata.create_all(bind=conn)
        _add_missing_columns(conn)
        _drop_legacy_global_unique_indexes(conn, dialect)
        _backfill_data(conn, dialect)
        for stmt in INDEX_STATEMENTS:
            conn.execute(text(stmt))


def ensure_schema(engine: Engine, raise_on_error: bool = False) -> bool:
    """Run migrations; return True on success. Startup callers pass raise_on_error=False."""
    try:
        run_schema_migrations(engine)
        return True
    except Exception:
        logger.exception("Database schema migration failed")
        if raise_on_error:
            raise
        return False


if __name__ == "__main__":  # pragma: no cover - deployment entrypoint
    from app.database.base import engine as _engine

    ensure_schema(_engine, raise_on_error=True)
    print("Database schema is up to date.")
