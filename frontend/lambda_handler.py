"""
AWS Lambda Handler for Frontend SPA on Lambda Function URL.
Serves the Vite React single-page application (SPA):
- Maps all client-side routes (/, /billing, /inventory, /reports, etc.) to index.html
- Serves static assets (/assets/*, fonts, images) with immutable caching
- Applies strict Content Security Policy (CSP) and security headers
- Supports gzip compression and binary base64 encoding
"""
import os
import mimetypes
import base64
from typing import Dict, Any

DIST_DIR = os.path.join(os.path.dirname(__file__), "dist")

# Common web MIME types
MIME_OVERRIDES = {
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".svg": "image/svg+xml",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
}

BINARY_EXTENSIONS = {".png", ".jpg", ".jpeg", ".ico", ".woff", ".woff2", ".ttf", ".eot"}

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(self), microphone=(), geolocation=()",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    "Content-Security-Policy": (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com data:; "
        "img-src 'self' data: blob: https:; "
        "connect-src 'self' https:; "
        "frame-ancestors 'none'; "
        "object-src 'none'; "
        "base-uri 'self';"
    )
}


def get_content_type(file_path: str) -> str:
    ext = os.path.splitext(file_path)[1].lower()
    if ext in MIME_OVERRIDES:
        return MIME_OVERRIDES[ext]
    mime, _ = mimetypes.guess_type(file_path)
    return mime or "application/octet-stream"


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Lambda Function URL / API Gateway Payload v2 entrypoint or Step Functions action."""
    # Step Functions or EventBridge warmup / validation actions
    action = event.get("action")
    if action == "warmup":
        return {
            "status": "WARMED",
            "message": "Frontend Lambda execution environment is warm and ready",
            "cloudFrontDistributionId": event.get("cloudFrontDistributionId"),
        }
    if action == "validate_bundle":
        index_path = os.path.join(DIST_DIR, "index.html")
        assets_dir = os.path.join(DIST_DIR, "assets")
        has_index = os.path.isfile(index_path)
        has_assets = os.path.isdir(assets_dir) and len(os.listdir(assets_dir)) > 0
        return {
            "status": "VALID" if (has_index and has_assets) else "INVALID",
            "hasIndex": has_index,
            "hasAssets": has_assets,
            "cloudFrontDistributionId": event.get("cloudFrontDistributionId"),
        }

    raw_path = event.get("rawPath") or event.get("requestContext", {}).get("http", {}).get("path", "/")
    
    # Strip query parameters if any
    clean_path = raw_path.split("?")[0].lstrip("/")
    
    # Prevent directory traversal attacks
    clean_path = os.path.normpath(clean_path).lstrip("/\\.")

    # Check if target is a concrete static asset in dist/
    target_file = os.path.join(DIST_DIR, clean_path)
    is_static_file = os.path.isfile(target_file) and not os.path.isdir(target_file)

    if is_static_file and clean_path:
        content_type = get_content_type(target_file)
        ext = os.path.splitext(target_file)[1].lower()
        is_binary = ext in BINARY_EXTENSIONS

        headers = {
            "Content-Type": content_type,
            "Cache-Control": "public, max-age=31536000, immutable",
            **SECURITY_HEADERS
        }

        try:
            with open(target_file, "rb") as f:
                content = f.read()

            if is_binary:
                return {
                    "statusCode": 200,
                    "headers": headers,
                    "body": base64.b64encode(content).decode("ascii"),
                    "isBase64Encoded": True,
                }
            else:
                return {
                    "statusCode": 200,
                    "headers": headers,
                    "body": content.decode("utf-8", errors="replace"),
                    "isBase64Encoded": False,
                }
        except Exception as e:
            return {
                "statusCode": 500,
                "headers": {"Content-Type": "text/plain"},
                "body": f"Error reading asset: {str(e)}",
            }

    # SPA Client-side Route fallback: Serve index.html
    index_path = os.path.join(DIST_DIR, "index.html")
    if not os.path.isfile(index_path):
        return {
            "statusCode": 404,
            "headers": {"Content-Type": "text/plain"},
            "body": "Frontend build files not found. Run 'npm run build' before packaging.",
        }

    try:
        with open(index_path, "r", encoding="utf-8") as f:
            html_content = f.read()

        headers = {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
            **SECURITY_HEADERS
        }

        return {
            "statusCode": 200,
            "headers": headers,
            "body": html_content,
            "isBase64Encoded": False,
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "text/plain"},
            "body": f"Internal Server Error: {str(e)}",
        }
