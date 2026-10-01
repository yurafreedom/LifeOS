from functools import lru_cache
from typing import Literal
from urllib.parse import urlsplit

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_POSTGRESQL_DIALECT = "postgresql+psycopg"
_URL_SEPARATOR = "://"
_POSTGRESQL_DRIVER = _POSTGRESQL_DIALECT + _URL_SEPARATOR
# Safe upper bound for one document version (see document_max_bytes).
MAX_DOCUMENT_BYTES = 50 * 1024 * 1024


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
    # Adaptive Analytics write gate. Personal semantic history must not begin
    # accumulating before the export and erasure foundation (Slice 0b) exists,
    # so every AA write path is closed unless a deployment opts in explicitly.
    # Tests enable it deliberately; production may not enable it at all yet.
    aa_write_enabled: bool = False

    # ── JENKIN S1 · account security ─────────────────────────────────────
    # Public address of the web app, used only to build links in mail
    # (password reset, email verification, invitations). Required in
    # production (https); development falls back to the first allowed origin.
    public_app_url: str | None = None
    # Mail delivery behind one interface (app/mail):
    #   disabled — nothing can be sent; flows that need mail say so honestly;
    #   memory   — tests only (in-process outbox);
    #   file     — development only: one .eml file per message in mail_file_dir;
    #   smtp     — production SMTP (STARTTLS or implicit TLS).
    mail_backend: Literal["disabled", "memory", "file", "smtp"] = "disabled"
    mail_from: str | None = None
    mail_file_dir: str | None = None
    smtp_host: str | None = None
    smtp_port: int = Field(default=587, gt=0, lt=65536)
    smtp_username: str | None = None
    smtp_password: SecretStr | None = None
    smtp_security: Literal["starttls", "ssl", "none"] = "starttls"
    smtp_timeout_seconds: float = Field(default=10.0, gt=0)
    # Token lifetimes (seconds). Invitations: 7 days (owner decision).
    invitation_ttl_seconds: int = Field(default=7 * 24 * 3600, gt=0)
    password_reset_ttl_seconds: int = Field(default=3600, gt=0)
    email_verification_ttl_seconds: int = Field(default=24 * 3600, gt=0)
    # Reverse proxies whose X-Forwarded-For entries are trusted for the client
    # network used by throttling and audit. 0 = use the socket peer address.
    trusted_proxy_hops: int = Field(default=0, ge=0, le=5)
    # Security audit events older than this are purged opportunistically.
    audit_retention_days: int = Field(default=365, gt=0)

    # ── JENKIN S2 · encrypted documents ──────────────────────────────────
    # Off by default. When on, the API refuses to start unless the keyring
    # file loads and validates (app/crypto/keyring.py): there is no plaintext
    # fallback and no implicit key generation.
    documents_enabled: bool = False
    # Restricted JSON keyring (0600/0400, owned by the service user or root).
    # Keep it outside the repository and outside database backups.
    keyring_file: str | None = None
    # Permit 0440 for secret mounts that grant read through a dedicated group.
    keyring_allow_group_read: bool = False
    # Upload limit per content version. 15 MiB by default; never above 50 MiB
    # (whole-object AES-GCM keeps one version in memory at a time).
    document_max_bytes: int = Field(default=15 * 1024 * 1024, gt=0, le=MAX_DOCUMENT_BYTES)
    # Per-account bounds (documents, and plaintext bytes across all versions).
    document_max_per_account: int = Field(default=1000, gt=0, le=100_000)
    document_max_account_bytes: int = Field(default=512 * 1024 * 1024, gt=0, le=8 * 1024**3)
    # Uploads, downloads and document exports held in memory at once per process.
    document_max_concurrent_transfers: int = Field(default=4, gt=0, le=32)

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
            if self.aa_write_enabled:
                raise ValueError(
                    "aa_write_enabled must stay false in production until account export "
                    "and erasure exist"
                )
            if self.mail_backend in {"memory", "file"}:
                raise ValueError("memory and file mail backends are not allowed in production")
            if self.mail_backend == "smtp":
                if not self.smtp_host or not self.mail_from or not self.public_app_url:
                    raise ValueError(
                        "smtp mail requires smtp_host, mail_from and public_app_url"
                    )
                if self.smtp_security == "none":
                    raise ValueError("smtp_security none is not allowed in production")
            if self.public_app_url and not self.public_app_url.startswith("https://"):
                raise ValueError("public_app_url must be https in production")
        if self.documents_enabled and not self.keyring_file:
            raise ValueError("documents_enabled requires keyring_file (no plaintext fallback)")
        if self.mail_backend == "file" and not self.mail_file_dir:
            raise ValueError("the file mail backend requires mail_file_dir")
        return self

    @property
    def app_url(self) -> str:
        """Base URL for links in mail (no trailing slash)."""
        return (self.public_app_url or self.allowed_origins[0]).rstrip("/")

    @property
    def cookie_name(self) -> str:
        if self.environment == "production":
            return "__Host-lifeos_session"
        return "lifeos_session"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
