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
    ".txt": "text/plain; charset=utf-8",
    ".xml": "application/xml; charset=utf-8",
}

BINARY_EXTENSIONS = {".png", ".jpg", ".jpeg", ".ico", ".woff", ".woff2", ".ttf", ".eot"}

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(self), microphone=(), geolocation=()",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "unsafe-none",
    "Content-Security-Policy": (
        "default-src 'self'; "
        "script-src 'self' https://accounts.google.com https://apis.google.com https://cdn.jsdelivr.net; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com https://cdn.jsdelivr.net; "
        "font-src 'self' https://fonts.gstatic.com data:; "
        "img-src 'self' data: blob: https:; "
        "connect-src 'self' https: https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com; "
        "frame-src 'self' https://accounts.google.com; "
        "frame-ancestors 'none'; "
        "object-src 'none'; "
        "base-uri 'self'; "
        "form-action 'self';"
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

    # Google OAuth Verification Bridge (runs in Frontend Lambda outside VPC with direct internet)
    if clean_path == "oauth/google-verify":
        import json
        import hmac
        import hashlib
        import time
        import urllib.request
        import urllib.parse
        import urllib.error

        method = event.get("requestContext", {}).get("http", {}).get("method", "POST")
        if method == "OPTIONS":
            return {
                "statusCode": 204,
                "headers": {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization",
                },
                "body": "",
                "isBase64Encoded": False,
            }

        try:
            raw_body = event.get("body") or "{}"
            if event.get("isBase64Encoded"):
                raw_body = base64.b64decode(raw_body).decode("utf-8")
            payload = json.loads(raw_body)
            token_str = (payload.get("credential") or "").strip()
        except Exception:
            token_str = ""

        if not token_str:
            return {
                "statusCode": 400,
                "headers": {"Content-Type": "application/json", **SECURITY_HEADERS},
                "body": json.dumps({"detail": "Google credential token is missing."}),
                "isBase64Encoded": False,
            }

        google_data = None
        param_key = "id_token" if token_str.count(".") == 2 else "access_token"
        tokeninfo_url = f"https://oauth2.googleapis.com/tokeninfo?{urllib.parse.urlencode({param_key: token_str})}"
        try:
            with urllib.request.urlopen(tokeninfo_url, timeout=6) as resp:
                if resp.status == 200:
                    google_data = json.loads(resp.read().decode("utf-8"))
        except Exception:
            google_data = None

        if google_data and param_key == "access_token":
            try:
                u_req = urllib.request.Request(
                    "https://www.googleapis.com/oauth2/v3/userinfo",
                    headers={"Authorization": f"Bearer {token_str}"},
                )
                with urllib.request.urlopen(u_req, timeout=4) as u_resp:
                    if u_resp.status == 200:
                        google_data.update(json.loads(u_resp.read().decode("utf-8")))
            except Exception:
                pass

        if not google_data:
            return {
                "statusCode": 401,
                "headers": {"Content-Type": "application/json", **SECURITY_HEADERS},
                "body": json.dumps({"detail": "Google verification failed: invalid or expired token."}),
                "isBase64Encoded": False,
            }

        expected_cid = os.environ.get(
            "GOOGLE_CLIENT_ID",
            "995123724994-6ejbal37p88sp32fmedph6k296uf8n7k.apps.googleusercontent.com",
        ).strip()
        token_aud = google_data.get("aud") or google_data.get("azp") or ""
        if expected_cid and token_aud != expected_cid:
            return {
                "statusCode": 401,
                "headers": {"Content-Type": "application/json", **SECURITY_HEADERS},
                "body": json.dumps({"detail": "Google token was not issued for this application."}),
                "isBase64Encoded": False,
            }

        bridge_secret_str = (os.environ.get("GOOGLE_BRIDGE_SECRET") or "").strip()
        if not bridge_secret_str or len(bridge_secret_str) < 32:
            return {
                "statusCode": 500,
                "headers": {"Content-Type": "application/json", **SECURITY_HEADERS},
                "body": json.dumps({"detail": "Google OAuth bridge secret is not configured on this server."}),
                "isBase64Encoded": False,
            }
        bridge_secret = bridge_secret_str.encode("utf-8")
        claims = {
            "email": google_data.get("email"),
            "email_verified": google_data.get("email_verified") or google_data.get("verified_email"),
            "sub": google_data.get("sub"),
            "name": google_data.get("name") or google_data.get("given_name"),
            "aud": token_aud,
            "exp": int(time.time()) + 120,
        }
        claims_b64 = base64.urlsafe_b64encode(
            json.dumps(claims, separators=(",", ":"), sort_keys=True).encode("utf-8")
        ).decode("ascii").rstrip("=")
        sig = hmac.new(bridge_secret, claims_b64.encode("ascii"), hashlib.sha256).hexdigest()
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json", **SECURITY_HEADERS},
            "body": json.dumps({"verified_credential": f"nockbill_gauth.{claims_b64}.{sig}"}),
            "isBase64Encoded": False,
        }

    # API Reverse Proxy (enables direct Frontend Function URL testing before CloudFront)
    backend_url = os.environ.get("BACKEND_API_URL")
    if backend_url and (clean_path.startswith("api/") or clean_path == "api"):
        import urllib.request
        import urllib.error
        target_url = f"{backend_url.rstrip('/')}/{clean_path}"
        raw_qs = event.get("rawQueryString", "")
        if raw_qs:
            target_url += f"?{raw_qs}"

        method = event.get("requestContext", {}).get("http", {}).get("method", "GET")
        body_data = event.get("body")
        if body_data and event.get("isBase64Encoded"):
            body_data = base64.b64decode(body_data)
        elif body_data and isinstance(body_data, str):
            body_data = body_data.encode("utf-8")
        else:
            body_data = None

        # Fast preflight response
        if method == "OPTIONS":
            return {
                "statusCode": 204,
                "headers": {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "*",
                    "Access-Control-Allow-Headers": "*",
                },
                "body": "",
                "isBase64Encoded": False,
            }

        HOP_BY_HOP = {
            "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
            "te", "trailers", "transfer-encoding", "upgrade", "content-length",
            "content-encoding", "host"
        }

        def clean_headers(header_items):
            out = {}
            for k, v in header_items:
                kl = k.lower()
                # Lambda Function URLs reserve x-amzn-* and reject responses returning them
                if kl in HOP_BY_HOP or kl.startswith("x-amzn-") or kl.startswith("x-amz-"):
                    continue
                out[k] = v
            out["access-control-allow-origin"] = "*"
            out["access-control-allow-credentials"] = "true"
            return out

        req_headers = {
            k: v for k, v in event.get("headers", {}).items()
            if k.lower() not in ("host", "content-length", "x-forwarded-for", "x-forwarded-proto")
        }

        try:
            req = urllib.request.Request(target_url, data=body_data, headers=req_headers, method=method)
            with urllib.request.urlopen(req, timeout=25) as resp:
                resp_bytes = resp.read()
                resp_headers = clean_headers(resp.getheaders())
                return {
                    "statusCode": resp.status,
                    "headers": resp_headers,
                    "body": base64.b64encode(resp_bytes).decode("ascii"),
                    "isBase64Encoded": True,
                }
        except urllib.error.HTTPError as err:
            err_bytes = err.read()
            err_headers = clean_headers(err.headers.items())
            return {
                "statusCode": err.code,
                "headers": err_headers,
                "body": base64.b64encode(err_bytes).decode("ascii"),
                "isBase64Encoded": True,
            }
        except Exception as err:
            return {
                "statusCode": 502,
                "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
                "body": f'{{"error": "Backend Function URL proxy failed: {str(err)}"}}',
                "isBase64Encoded": False,
            }

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
