from functools import lru_cache
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    app_name: str = "AssetFlow API"
    api_prefix: str = "/api"
    environment: str = "development"
    create_tables_on_startup: bool = True

    secret_key: str = "change-me"
    access_token_minutes: int = 15
    refresh_token_days: int = 7
    access_cookie_name: str = "assetflow_access"
    refresh_cookie_name: str = "assetflow_refresh"
    cookie_secure: bool = False

    database_url: str = "sqlite:///./assetflow.db"
    redis_url: str = "redis://redis:6379/0"
    outbox_batch_size: int = 200

    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:8080"])
    default_base_currency: str = "USD"
    default_timezone: str = "UTC"
    coingecko_base_url: str = "https://api.coingecko.com/api/v3"
    coingecko_api_key: Optional[str] = None
    twelvedata_base_url: str = "https://api.twelvedata.com"
    twelvedata_api_key: Optional[str] = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
