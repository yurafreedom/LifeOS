import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, SecretStr


class BootstrapRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    password: SecretStr = Field(min_length=12, max_length=1024)
    bootstrap_token: SecretStr = Field(min_length=32, max_length=4096)


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    password: SecretStr = Field(min_length=1, max_length=1024)


class SessionUser(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: uuid.UUID
    email: EmailStr
    created_at: datetime
    role: str
    email_verified_at: datetime | None


def NewPassword():  # noqa: N802 - reads like a type in the field declarations
    return Field(min_length=12, max_length=1024)


def TokenField():  # noqa: N802
    return Field(min_length=20, max_length=200)


class PasswordResetRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr


class PasswordResetConfirm(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: SecretStr = TokenField()
    new_password: SecretStr = NewPassword()


class TokenOnly(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: SecretStr = TokenField()


class InvitationAccept(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: SecretStr = TokenField()
    email: EmailStr
    password: SecretStr = NewPassword()


class InvitationPreview(BaseModel):
    email: EmailStr
    expires_at: datetime


class PasswordChange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current_password: SecretStr = Field(min_length=1, max_length=1024)
    new_password: SecretStr = NewPassword()


class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    last_seen_at: datetime
    expires_at: datetime
    device: str | None
    current: bool


class SessionList(BaseModel):
    sessions: list[SessionOut]


class InvitationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr


class InvitationOut(BaseModel):
    id: uuid.UUID
    email: EmailStr
    created_at: datetime
    expires_at: datetime
    status: str
    delivery: str


class InvitationCreated(InvitationOut):
    # Present only when the link was not delivered by mail; shown once.
    invite_url: str | None


class InvitationList(BaseModel):
    invitations: list[InvitationOut]


class SecurityEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    event: str
    occurred_at: datetime
    device_label: str | None
    network: str | None


class SecurityEventList(BaseModel):
    events: list[SecurityEventOut]
