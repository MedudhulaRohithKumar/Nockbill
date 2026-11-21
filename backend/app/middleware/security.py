"""
Security and Caching Middleware for AWS Lambda Function URL and API Gateway / CloudFront.
- Implements strict Content Security Policy (CSP)
- Hides backend server identifiers and sensitive headers
- Sets HSTS, X-Content-Type-Options, X-Frame-Options, Permissions-Policy
- Implements appropriate Cache-Control headers for APIs and assets
"""
from urllib.parse import urlparse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.config.settings import settings


_DOC_PATHS = {"/docs", "/redoc", "/docs/oauth2-redirect"}
_DOCS_ENABLED = bool(settings.debug or settings.enable_api_docs)
_MUTATION_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def _extract_origin(raw_url: str) -> str:
    parsed = urlparse((raw_url or "").strip())
    if not parsed.scheme or not parsed.netloc:
        return ""
    return f"{parsed.scheme.lower()}://{parsed.netloc.lower()}"


def _is_csrf_origin_allowed(request: Request) -> bool:
    """Defense-in-depth CSRF check for cookie-authenticated state-changing requests."""
    if request.method.upper() not in _MUTATION_METHODS:
        return True
    if not request.cookies.get("access_token"):
        return True
    # Explicit Bearer-authenticated API/CLI calls are immune to ambient browser cookie CSRF
    if request.headers.get("authorization", "").lower().startswith("bearer "):
        return True

    raw_source = request.headers.get("origin") or request.headers.get("referer") or ""
    if not raw_source:
        return True

    req_origin = _extract_origin(raw_source)
    if not req_origin:
        return False

    allowed = {o.lower() for o in settings.cors_origins}
    app_origin = _extract_origin(getattr(settings, "app_base_url", "") or "")
    if app_origin:
        allowed.add(app_origin)
    host_hdr = (request.headers.get("host") or "").strip().lower()
    if host_hdr:
        allowed.add(f"https://{host_hdr}")
        allowed.add(f"http://{host_hdr}")
    return req_origin in allowed


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next) -> Response:
        if not _is_csrf_origin_allowed(request):
            return JSONResponse(
                status_code=403,
                content={"detail": "Cross-origin request blocked by CSRF protection."},
            )
        response = await call_next(request)

        # ── 1. Content Security Policy (CSP) ───────────────────────────────────
        # This service returns JSON/PDF/images only, so the default policy is deny-all.
        # Interactive API docs (only exposed when explicitly enabled) need a relaxed policy.
        path_for_csp = request.url.path
        if _DOCS_ENABLED and path_for_csp in _DOC_PATHS:
            csp_directives = [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
                "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
                "img-src 'self' data: https://fastapi.tiangolo.com",
                "connect-src 'self'",
                "frame-ancestors 'none'",
                "object-src 'none'",
                "base-uri 'self'",
            ]
        else:
            csp_directives = [
                "default-src 'none'",
                "img-src 'self' data:",
                "frame-ancestors 'none'",
                "base-uri 'none'",
                "form-action 'none'",
            ]
        response.headers["Content-Security-Policy"] = "; ".join(csp_directives)

        # ── 2. Security Headers & Clickjacking Prevention ─────────────────────
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(self), microphone=(), geolocation=()"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin-allow-popups"
        response.headers["Cross-Origin-Resource-Policy"] = "same-origin"
        response.headers["Cross-Origin-Embedder-Policy"] = "unsafe-none"

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
        elif path.startswith("/uploads/") or path.startswith("/api/uploads/"):
            # Authenticated tenant-scoped uploads must never be cached by shared proxies/CDNs (M1)
            response.headers["Cache-Control"] = "private, max-age=3600"
        elif path.startswith("/assets/"):
            # Public static bundle files
            response.headers["Cache-Control"] = "public, max-age=86400, stale-while-revalidate=3600"
        else:
            # Default for dynamic GET queries
            if "Cache-Control" not in response.headers:
                response.headers["Cache-Control"] = "private, no-cache"

        return response
