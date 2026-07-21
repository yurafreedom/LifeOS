from functools import lru_cache
from typing import Literal
from urllib.parse import urlsplit

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_POSTGRESQL_DIALECT = "postgresql+psycopg"
_URL_SEPARATOR = "://"
_POSTGRESQL_DRIVER = _POSTGRESQL_DIALECT + _URL_SEPARATOR


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="LIFEOS_",
        case_sensitive=False,
        extra="ignore",
    )

    environment: Literal["development", "test", "production"] = "development"
    database_url: str
    bootstrap_token: SecretStr = Field(min_length=32)
    allowed_hosts: list[str] = Field(default_factory=lambda: ["localhost", "127.0.0.1"])
    allowed_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])
    cookie_secure: bool = False
    session_ttl_seconds: int = Field(default=2_592_000, gt=0)
    session_touch_interval_seconds: int = Field(default=900, gt=0)
    max_snapshot_bytes: int = Field(default=5_242_880, gt=0)

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, value: str) -> str:
        if not value.startswith(_POSTGRESQL_DRIVER):
            raise ValueError(f"database_url must use {_POSTGRESQL_DRIVER}")
        return value

    @field_validator("allowed_hosts")
    @classmethod
    def normalize_hosts(cls, values: list[str]) -> list[str]:
        hosts = [value.strip() for value in values if value.strip()]
        if not hosts:
            raise ValueError("allowed_hosts must not be empty")
        return hosts

    @field_validator("allowed_origins")
    @classmethod
    def normalize_origins(cls, values: list[str]) -> list[str]:
        origins: list[str] = []
        for raw_value in values:
            value = raw_value.strip().rstrip("/")
            parsed = urlsplit(value)
            if not parsed.scheme or not parsed.netloc or parsed.path:
                raise ValueError(f"invalid origin: {raw_value}")
            origins.append(value)
        if not origins:
            raise ValueError("allowed_origins must not be empty")
        return origins

    @model_validator(mode="after")
    def validate_production_security(self) -> "Settings":
        if self.environment == "production":
            if not self.cookie_secure:
                raise ValueError("cookie_secure must be true in production")
            if "*" in self.allowed_hosts or "*" in self.allowed_origins:
                raise ValueError("wildcard hosts and origins are forbidden in production")
        return self

    @property
    def cookie_name(self) -> str:
        if self.environment == "production":
            return "__Host-lifeos_session"
        return "lifeos_session"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
