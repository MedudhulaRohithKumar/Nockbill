from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text
import os

from app.config.settings import settings
from app.routers import auth, products, sales, purchases, inventory, ocr, reports, expenses, settings as settings_router, invoices, returns
from app.database.base import Base, engine
import app.models.models  # noqa – ensure all models are registered

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="NockBill Solutions — Agricultural & Fertilizer Shop Management & Billing System",
)

# ── Auto-create any missing tables on startup ─────────────────────────────────
Base.metadata.create_all(bind=engine)


def _run_schema_migrations(db_engine) -> None:
    """Safely ensure new columns and indexes exist on existing databases."""
    try:
        inspector = inspect(db_engine)
        existing_tables = set(inspector.get_table_names())
        column_migrations = [
            ("products", "trade_name", "VARCHAR(200)"),
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
            # Create composite indexes for fast tenant & trade-name lookups if missing
            index_statements = [
                "CREATE INDEX IF NOT EXISTS ix_product_shop_active ON products (shop_id, is_active)",
                "CREATE INDEX IF NOT EXISTS ix_product_shop_trade ON products (shop_id, trade_name)",
                "CREATE INDEX IF NOT EXISTS ix_sale_shop_date ON sales (shop_id, sale_date)",
                "CREATE INDEX IF NOT EXISTS ix_sale_items_sale_id ON sale_items (sale_id)",
                "CREATE INDEX IF NOT EXISTS ix_purchase_items_purchase_id ON purchase_items (purchase_id)",
            ]
            for stmt in index_statements:
                try:
                    conn.execute(text(stmt))
                except Exception:
                    pass
    except Exception:
        pass


_run_schema_migrations(engine)

# ── Security & Caching Middleware ─────────────────────────────────────────────
from app.middleware.security import SecurityHeadersMiddleware
app.add_middleware(SecurityHeadersMiddleware)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(products.router)
app.include_router(sales.router)
app.include_router(returns.router)
app.include_router(purchases.router)
app.include_router(inventory.router)
app.include_router(ocr.router)
app.include_router(reports.router)
app.include_router(expenses.router)
app.include_router(settings_router.router)
app.include_router(invoices.router)

# ── Static files (logo uploads) ───────────────────────────────────────────────
if os.path.exists(settings.upload_dir):
    app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")


@app.get("/health")
def health():
    return {"status": "ok", "version": settings.app_version}


@app.get("/")
def root():
    return {"message": f"Welcome to {settings.app_name} API"}
