"""
Security and Caching Middleware for AWS Lambda Function URL and API Gateway / CloudFront.
- Implements strict Content Security Policy (CSP)
- Hides backend server identifiers and sensitive headers
- Sets HSTS, X-Content-Type-Options, X-Frame-Options, Permissions-Policy
- Implements appropriate Cache-Control headers for APIs and assets
"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
from starlette.requests import Request
from starlette.responses import Response

from app.config.settings import settings


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        # ── 1. Content Security Policy (CSP) ───────────────────────────────────
        # Permits camera for POS barcode scanner, Google Fonts, and secure API connect
        csp_connect = "'self' https:"
        if settings.frontend_function_url:
            csp_connect += f" {settings.frontend_function_url}"

        csp_directives = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com data:",
            "img-src 'self' data: blob: https:",
            f"connect-src {csp_connect}",
            "frame-ancestors 'none'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
        ]
        response.headers["Content-Security-Policy"] = "; ".join(csp_directives)

        # ── 2. Security Headers & Clickjacking Prevention ─────────────────────
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(self), microphone=(), geolocation=()"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"

        # ── 3. Strip Sensitive Server Fingerprint Headers ─────────────────────
        if "server" in response.headers:
            del response.headers["server"]
        if "x-powered-by" in response.headers:
            del response.headers["x-powered-by"]

        # ── 4. Intelligent Caching Headers ────────────────────────────────────
        path = request.url.path
        method = request.method

        if method in ("POST", "PUT", "DELETE", "PATCH"):
            # Never cache data-modifying mutations
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
            response.headers["Pragma"] = "no-cache"
        elif path.startswith("/api/auth") or path.startswith("/api/sales"):
            # Transactional & authenticated endpoints
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        elif path.startswith("/api/products/frequently-sold") or path.startswith("/api/settings"):
            # Master data & lookup endpoints: cache lightly for 30s with revalidation
            if "Cache-Control" not in response.headers:
                response.headers["Cache-Control"] = "private, max-age=30, stale-while-revalidate=60"
        elif path.startswith("/uploads/") or path.startswith("/assets/"):
            # Static logos & static bundle files
            response.headers["Cache-Control"] = "public, max-age=86400, stale-while-revalidate=3600"
        else:
            # Default for dynamic GET queries
            if "Cache-Control" not in response.headers:
                response.headers["Cache-Control"] = "private, no-cache"

        return response
