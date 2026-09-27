from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.config.settings import settings
from app.routers import auth, products, sales, purchases, inventory, ocr, reports, expenses, settings as settings_router, invoices, returns
from app.database.base import Base, engine
import app.models.models  # noqa – ensure all models are registered

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Fertilizer Shop Management & Billing System",
)

# ── Auto-create any missing tables on startup ─────────────────────────────────
Base.metadata.create_all(bind=engine)

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
