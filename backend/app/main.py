from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.config.settings import settings
from app.routers import auth, products, sales, purchases, inventory, ocr, reports, expenses, settings as settings_router, invoices, returns, price_lists
from app.database.base import engine, get_db
from app.database.migrations import ensure_schema
from app.middleware.security import SecurityHeadersMiddleware
from app.models.models import User
from app.utils.auth import get_current_user
import app.models.models  # noqa – ensure all models are registered

_DOCS_ENABLED = bool(settings.debug or settings.enable_api_docs)

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="NockBill Solutions — Agricultural & Fertilizer Shop Management & Billing System",
    # Never publish the API surface (OpenAPI schema / Swagger UI) in production.
    docs_url="/docs" if _DOCS_ENABLED else None,
    redoc_url="/redoc" if _DOCS_ENABLED else None,
    openapi_url="/openapi.json" if _DOCS_ENABLED else None,
)

# ── Schema bootstrap ──────────────────────────────────────────────────────────
# Production (Lambda) sets AUTO_MIGRATE_ON_STARTUP=false: migrations run once as a deployment
# step (`migrate_and_seed` action / `python -m app.database.migrations`), never on cold start.
if settings.auto_migrate_on_startup:
    ensure_schema(engine)

# ── Security & Caching Middleware ─────────────────────────────────────────────
app.add_middleware(SecurityHeadersMiddleware)

# ── CORS: explicit allowlist (credentials are enabled, so a wildcard is never acceptable) ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Idempotency-Key", "X-Requested-With"],
    expose_headers=["X-Total-Count", "Content-Disposition"],
    max_age=600,
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(products.router)
app.include_router(price_lists.router)
app.include_router(sales.router)
app.include_router(returns.router)
app.include_router(purchases.router)
app.include_router(inventory.router)
app.include_router(ocr.router)
app.include_router(reports.router)
app.include_router(expenses.router)
app.include_router(settings_router.router)
app.include_router(invoices.router)

# ── Authenticated, tenant-scoped file serving (replaces unauthenticated /uploads mount — M1) ─
@app.get("/uploads/{filename}")
@app.get("/api/uploads/{filename}")
def get_uploaded_file(
    filename: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return settings_router.serve_tenant_upload(filename, db, current_user)


@app.get("/health")
def health():
    return {"status": "ok", "version": settings.app_version}


@app.get("/")
def root():
    return {"message": f"Welcome to {settings.app_name} API"}
