"""
Google Sign-In token verification.

Supports both credential types issued by Google Identity Services:
  * ID Token (JWT)      -> verified locally against Google's cached public JWKS
                           (signature, issuer, audience, expiry).
  * OAuth2 Access Token -> verified via Google's tokeninfo endpoint with a strict
                           audience check so tokens minted for other apps are rejected.

Network failures are reported separately from invalid tokens so the user sees an
accurate error (a VPC Lambda without outbound internet access cannot reach Google).
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import threading
import time
from typing import Optional

import httpx
from jose import jwt, JWTError

GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
GOOGLE_ISSUERS = ("accounts.google.com", "https://accounts.google.com")
BRIDGE_PREFIX = "nockbill_gauth."
DEFAULT_BRIDGE_SECRET = "nockbill-google-oauth-bridge-hmac-2026-995123724994"

# Keep total worst-case latency far below the API Gateway 30 s integration limit.
_TIMEOUT = httpx.Timeout(connect=3.0, read=4.0, write=4.0, pool=3.0)

_jwks_lock = threading.Lock()
_jwks_cache: dict = {"keys": None, "expires_at": 0.0}


class GoogleVerificationError(Exception):
    """Token is invalid, expired, or issued for a different application."""


class GoogleUnreachableError(Exception):
    """Server could not reach Google's verification endpoints (network/egress issue)."""


def _get_jwks() -> list:
    now = time.time()
    if _jwks_cache["keys"] and now < _jwks_cache["expires_at"]:
        return _jwks_cache["keys"]
    with _jwks_lock:
        if _jwks_cache["keys"] and now < _jwks_cache["expires_at"]:
            return _jwks_cache["keys"]
        try:
            resp = httpx.get(GOOGLE_JWKS_URL, timeout=_TIMEOUT)
            resp.raise_for_status()
        except (httpx.TimeoutException, httpx.NetworkError, httpx.HTTPStatusError) as exc:
            raise GoogleUnreachableError(str(exc)) from exc
        keys = resp.json().get("keys", [])
        max_age = 3600
        cache_control = resp.headers.get("cache-control", "")
        for part in cache_control.split(","):
            part = part.strip()
            if part.startswith("max-age="):
                try:
                    max_age = int(part.split("=", 1)[1])
                except ValueError:
                    pass
        _jwks_cache["keys"] = keys
        _jwks_cache["expires_at"] = now + max_age
        return keys


def _verify_id_token(token: str, client_id: str) -> dict:
    try:
        header = jwt.get_unverified_header(token)
    except JWTError as exc:
        raise GoogleVerificationError("Malformed Google ID token.") from exc

    kid = header.get("kid")
    keys = _get_jwks()
    key = next((k for k in keys if k.get("kid") == kid), None)
    if key is None:
        # Google may have rotated keys — force one refresh.
        _jwks_cache["expires_at"] = 0.0
        key = next((k for k in _get_jwks() if k.get("kid") == kid), None)
    if key is None:
        raise GoogleVerificationError("Google ID token signing key not recognised.")

    try:
        claims = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience=client_id,
            options={"verify_at_hash": False},
        )
    except JWTError as exc:
        raise GoogleVerificationError("Google ID token is invalid or expired.") from exc

    if claims.get("iss") not in GOOGLE_ISSUERS:
        raise GoogleVerificationError("Google ID token issuer is invalid.")
    return claims


def _verify_access_token(token: str, client_id: str) -> dict:
    try:
        resp = httpx.get(GOOGLE_TOKENINFO_URL, params={"access_token": token}, timeout=_TIMEOUT)
    except (httpx.TimeoutException, httpx.NetworkError) as exc:
        raise GoogleUnreachableError(str(exc)) from exc

    if resp.status_code != 200:
        raise GoogleVerificationError("Google access token is invalid or expired.")

    data = resp.json()
    token_aud = data.get("aud") or data.get("azp")
    if client_id and token_aud != client_id:
        raise GoogleVerificationError("Google token was not issued for this application.")

    # Enrich with profile (name) — best effort only.
    try:
        profile = httpx.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {token}"},
            timeout=_TIMEOUT,
        )
        if profile.status_code == 200:
            data.update(profile.json())
    except (httpx.TimeoutException, httpx.NetworkError):
        pass
    return data


def _verify_bridge_token(token: str, client_id: str) -> dict:
    """Verify an HMAC-SHA256 signed token issued by the Frontend Lambda OAuth bridge."""
    parts = token.split(".")
    if len(parts) != 3:
        raise GoogleVerificationError("Malformed Google verification token.")
    _, claims_b64, sig = parts
    bridge_secret = os.environ.get("GOOGLE_BRIDGE_SECRET", DEFAULT_BRIDGE_SECRET).encode("utf-8")
    expected_sig = hmac.new(bridge_secret, claims_b64.encode("ascii"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, expected_sig):
        raise GoogleVerificationError("Invalid Google verification signature.")

    try:
        padded = claims_b64 + "=" * (-len(claims_b64) % 4)
        claims = json.loads(base64.urlsafe_b64decode(padded).decode("utf-8"))
    except Exception as exc:
        raise GoogleVerificationError("Invalid Google verification payload.") from exc

    if int(claims.get("exp") or 0) < int(time.time()):
        raise GoogleVerificationError("Google verification token has expired. Please try again.")

    if client_id and claims.get("aud") and claims.get("aud") != client_id:
        raise GoogleVerificationError("Google token was not issued for this application.")

    return claims


def verify_google_token(token: str, client_id: Optional[str]) -> dict:
    """
    Verify a Google credential and return its claims (email, email_verified, sub, name...).

    Raises GoogleVerificationError for bad tokens and GoogleUnreachableError when the
    server has no route to Google.
    """
    token = (token or "").strip()
    if not token:
        raise GoogleVerificationError("Google credential token is missing.")
    client_id = (client_id or "").strip()

    if token.startswith(BRIDGE_PREFIX):
        return _verify_bridge_token(token, client_id)

    if token.count(".") == 2:
        if not client_id:
            raise GoogleVerificationError("Google Client ID is not configured on the server.")
        return _verify_id_token(token, client_id)
    return _verify_access_token(token, client_id)
