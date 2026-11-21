"""Initial baseline schema managed via SQLAlchemy ORM metadata.

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-11-21
"""
from alembic import op
from app.database.migrations import run_schema_migrations

revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    run_schema_migrations(bind.engine)


def downgrade() -> None:
    # Additive baseline migration; destructive downgrade is intentionally disabled.
    pass
