"""Helpers that resolve credentials from AWS Secrets Manager at process start.

Keeps the PostgreSQL master password out of Lambda environment variables
(visible through ``GetFunctionConfiguration`` and the AWS console).
"""
import json
from typing import Any, Dict
from urllib.parse import quote


class SecretResolutionError(RuntimeError):
    """Raised when the database secret cannot be fetched or is malformed."""


def _fetch_secret_json(secret_arn: str, region: str) -> Dict[str, Any]:
    try:
        import boto3  # imported lazily: only needed when DB_SECRET_ARN is configured
        client = boto3.client("secretsmanager", region_name=region or None)
        raw = client.get_secret_value(SecretId=secret_arn)["SecretString"]
        data = json.loads(raw)
    except Exception as exc:  # noqa: BLE001 - never leak provider internals
        raise SecretResolutionError(
            "Unable to load database credentials from AWS Secrets Manager."
        ) from exc
    if not isinstance(data, dict):
        raise SecretResolutionError("Database secret must be a JSON object.")
    return data


def build_database_url_from_secret(
    secret_arn: str,
    host: str,
    port: int,
    dbname: str,
    region: str,
) -> str:
    """Build a SQLAlchemy PostgreSQL URL from a Secrets Manager JSON secret."""
    secret = _fetch_secret_json(secret_arn, region)
    username = secret.get("username")
    password = secret.get("password")
    resolved_host = host or secret.get("host")
    resolved_port = port or secret.get("port") or 5432
    resolved_db = dbname or secret.get("dbname") or "postgres"
    if not username or not password or not resolved_host:
        raise SecretResolutionError(
            "Database secret must contain 'username' and 'password' (and DB_HOST must be set)."
        )
    return (
        f"postgresql+psycopg2://{quote(str(username), safe='')}:{quote(str(password), safe='')}"
        f"@{resolved_host}:{int(resolved_port)}/{resolved_db}"
    )
