"""Database-backed sliding-window rate limiter safe across multi-worker AWS Lambda."""
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import HTTPException, Request, status
from sqlalchemy.orm import Session

from app.models.models import RateLimitEvent

_GLOBAL_RETENTION_HOURS = 24


def _strip_port(raw_addr: str) -> str:
    """Strip :port suffix from CloudFront-Viewer-Address (supports IPv4:port and [IPv6]:port)."""
    addr = raw_addr.strip()
    if addr.startswith("[") and "]:" in addr:
        return addr[1:addr.index("]:")]
    if addr.count(":") == 1:
        return addr.split(":", 1)[0]
    return addr


def get_client_ip(request: Optional[Request]) -> str:
    """
    Extract authoritative client IP without trusting client-spoofable leftmost X-Forwarded-For (S2).
    Priority:
      1. Mangum/AWS Lambda Function URL / API Gateway authoritative requestContext.http.sourceIp
      2. CloudFront-Viewer-Address (injected by CloudFront edge, overrides viewer header)
      3. Direct TCP peer (request.client.host) when available and non-loopback/non-private proxy,
         or rightmost X-Forwarded-For entry appended by the immediate trusted proxy.
    """
    if request is None:
        return "unknown"

    aws_event = request.scope.get("aws.event") if getattr(request, "scope", None) else None
    if isinstance(aws_event, dict):
        req_ctx = aws_event.get("requestContext") or {}
        http_ctx = req_ctx.get("http") or {}
        source_ip = http_ctx.get("sourceIp") or (req_ctx.get("identity") or {}).get("sourceIp")
        if source_ip and str(source_ip).strip():
            return str(source_ip).strip()[:64]

    headers = request.headers if request.headers else {}
    cf_viewer = headers.get("cloudfront-viewer-address")
    if cf_viewer:
        cleaned = _strip_port(cf_viewer)
        if cleaned:
            return cleaned[:64]

    if request.client and request.client.host and request.client.host not in ("127.0.0.1", "::1", "testclient"):
        return str(request.client.host)[:64]

    xff = headers.get("x-forwarded-for")
    if xff:
        # Use the RIGHTMOST hop appended by the trusted reverse proxy, never client-controlled slot 0
        hops = [h.strip() for h in xff.split(",") if h.strip()]
        if hops:
            return hops[-1][:64]

    if request.client and request.client.host:
        return str(request.client.host)[:64]
    return "unknown"


def enforce_rate_limit(
    db: Session,
    action: str,
    key: str,
    limit: int,
    window_seconds: int,
) -> None:
    """
    Record an attempt in ``rate_limit_events`` and raise HTTP 429 if the caller
    has exceeded ``limit`` attempts within the past ``window_seconds``.
    Prunes both expired bucket entries and stale global rows (>24h) to prevent unbounded growth (SD6).
    """
    if limit <= 0 or window_seconds <= 0:
        return

    clean_key = (key or "unknown").strip().lower()[:140]
    bucket = f"{action}:{clean_key}"[:200]
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(seconds=window_seconds)
    global_cutoff = now - timedelta(hours=_GLOBAL_RETENTION_HOURS)

    db.query(RateLimitEvent).filter(
        RateLimitEvent.bucket == bucket,
        RateLimitEvent.created_at < cutoff,
    ).delete(synchronize_session="evaluate")

    # Bound table growth across distributed/one-off attacker buckets (SD6)
    db.query(RateLimitEvent).filter(
        RateLimitEvent.created_at < global_cutoff,
    ).delete(synchronize_session="evaluate")

    recent_count = (
        db.query(RateLimitEvent)
        .filter(
            RateLimitEvent.bucket == bucket,
            RateLimitEvent.created_at >= cutoff,
        )
        .count()
    )

    if recent_count >= limit:
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please wait and try again later.",
            headers={"Retry-After": str(window_seconds)},
        )

    db.add(RateLimitEvent(bucket=bucket, created_at=now))
    db.commit()
