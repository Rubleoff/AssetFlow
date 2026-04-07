from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.routes import api_router
from app.core.config import get_settings
from app.db.base import Base
from app.db.session import engine
from app.schemas.common import HealthResponse

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.create_tables_on_startup:
        Base.metadata.create_all(bind=engine)
        _ensure_runtime_schema_compat()
    yield


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", timestamp=datetime.now(tz=timezone.utc))


def _ensure_runtime_schema_compat() -> None:
    user_statements = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences JSON DEFAULT '{}'::json",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS import_preferences JSON DEFAULT '{}'::json",
    ]
    asset_statements = [
        "ALTER TABLE assets ADD COLUMN IF NOT EXISTS linked_account_id VARCHAR(36)",
        "ALTER TABLE assets ADD COLUMN IF NOT EXISTS tracking_enabled BOOLEAN DEFAULT FALSE",
        "ALTER TABLE assets ADD COLUMN IF NOT EXISTS tracking_provider VARCHAR(50)",
        "ALTER TABLE assets ADD COLUMN IF NOT EXISTS tracking_external_id VARCHAR(120)",
        "ALTER TABLE assets ADD COLUMN IF NOT EXISTS tracking_symbol VARCHAR(50)",
        "ALTER TABLE assets ADD COLUMN IF NOT EXISTS valuation_source VARCHAR(50) DEFAULT 'manual'",
        "ALTER TABLE assets ADD COLUMN IF NOT EXISTS rental_enabled BOOLEAN DEFAULT FALSE",
        "ALTER TABLE assets ADD COLUMN IF NOT EXISTS rental_income_monthly NUMERIC(14,2) DEFAULT 0",
        "ALTER TABLE assets ADD COLUMN IF NOT EXISTS rental_payment_frequency VARCHAR(20)",
        "ALTER TABLE assets ADD COLUMN IF NOT EXISTS rental_payment_day INTEGER",
        "ALTER TABLE assets ADD COLUMN IF NOT EXISTS notes TEXT",
    ]
    with engine.begin() as connection:
        dialect = connection.dialect.name
        if dialect == "postgresql":
            for statement in [*user_statements, *asset_statements]:
                connection.execute(text(statement))
            connection.execute(
                text(
                    "UPDATE users SET notification_preferences = '{}'::json WHERE notification_preferences IS NULL"
                )
            )
            connection.execute(
                text("UPDATE users SET import_preferences = '{}'::json WHERE import_preferences IS NULL")
            )
            connection.execute(text("UPDATE assets SET valuation_source = 'manual' WHERE valuation_source IS NULL"))
            return
        if dialect == "sqlite":
            pragma_rows = connection.execute(text("PRAGMA table_info(users)")).fetchall()
            columns = {row[1] for row in pragma_rows}
            if "notification_preferences" not in columns:
                connection.execute(text("ALTER TABLE users ADD COLUMN notification_preferences JSON DEFAULT '{}'"))
            if "import_preferences" not in columns:
                connection.execute(text("ALTER TABLE users ADD COLUMN import_preferences JSON DEFAULT '{}'"))
            asset_rows = connection.execute(text("PRAGMA table_info(assets)")).fetchall()
            asset_columns = {row[1] for row in asset_rows}
            sqlite_asset_columns = {
                "linked_account_id": "ALTER TABLE assets ADD COLUMN linked_account_id TEXT",
                "tracking_enabled": "ALTER TABLE assets ADD COLUMN tracking_enabled BOOLEAN DEFAULT 0",
                "tracking_provider": "ALTER TABLE assets ADD COLUMN tracking_provider TEXT",
                "tracking_external_id": "ALTER TABLE assets ADD COLUMN tracking_external_id TEXT",
                "tracking_symbol": "ALTER TABLE assets ADD COLUMN tracking_symbol TEXT",
                "valuation_source": "ALTER TABLE assets ADD COLUMN valuation_source TEXT DEFAULT 'manual'",
                "rental_enabled": "ALTER TABLE assets ADD COLUMN rental_enabled BOOLEAN DEFAULT 0",
                "rental_income_monthly": "ALTER TABLE assets ADD COLUMN rental_income_monthly NUMERIC DEFAULT 0",
                "rental_payment_frequency": "ALTER TABLE assets ADD COLUMN rental_payment_frequency TEXT",
                "rental_payment_day": "ALTER TABLE assets ADD COLUMN rental_payment_day INTEGER",
                "notes": "ALTER TABLE assets ADD COLUMN notes TEXT",
            }
            for column, statement in sqlite_asset_columns.items():
                if column not in asset_columns:
                    connection.execute(text(statement))
