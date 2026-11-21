import os

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config.settings import settings

# Each Lambda execution environment serves ONE request at a time, so a large pool only
# multiplies connections against RDS max_connections (db.t4g.micro allows ~80-112 total).
_ON_LAMBDA = bool(os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))
_POOL_SIZE = settings.db_pool_size if settings.db_pool_size > 0 else (1 if _ON_LAMBDA else 5)
_MAX_OVERFLOW = settings.db_max_overflow if settings.db_max_overflow >= 0 else (1 if _ON_LAMBDA else 10)

if "sqlite" in settings.database_url:
    engine = create_engine(
        settings.database_url,
        connect_args={"check_same_thread": False, "timeout": 30},
    )

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL;")
        cursor.execute("PRAGMA synchronous=NORMAL;")
        cursor.execute("PRAGMA busy_timeout=30000;")
        cursor.execute("PRAGMA foreign_keys=ON;")
        cursor.close()
else:
    engine = create_engine(
        settings.database_url,
        pool_pre_ping=True,
        pool_size=_POOL_SIZE,
        max_overflow=_MAX_OVERFLOW,
        pool_timeout=30,
        pool_recycle=1800,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
