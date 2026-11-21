"""Sanitized server error helpers with correlation IDs (never leak raw exception details)."""
import logging
import uuid
from fastapi import HTTPException, status


def internal_server_error(logger: logging.Logger, message: str) -> HTTPException:
    """Log the active exception with a short correlation ID and return a safe HTTP 500."""
    ref_id = uuid.uuid4().hex[:12]
    logger.exception("%s [ref=%s]", message, ref_id)
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=f"{message} (Reference: {ref_id})",
    )
