import logging
import smtplib
import ssl
import uuid
from dataclasses import dataclass
from email.message import EmailMessage
from email.utils import formatdate, make_msgid
from pathlib import Path
from typing import Protocol

from app.config import Settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class MailMessage:
    to: str
    subject: str
    text: str
    # A non-secret label for logs and tests ("password_reset", "invitation", ...).
    kind: str


class MailUnavailableError(Exception):
    """No delivery is configured: nothing was or could be sent."""


class MailDeliveryError(Exception):
    """Delivery was attempted and failed. The message was not sent."""


class MailDelivery(Protocol):
    @property
    def available(self) -> bool: ...

    def send(self, message: MailMessage) -> None: ...


def _envelope(message: MailMessage, sender: str) -> EmailMessage:
    email = EmailMessage()
    email["From"] = sender
    email["To"] = message.to
    email["Subject"] = message.subject
    email["Date"] = formatdate(localtime=False)
    email["Message-ID"] = make_msgid(domain=sender.rpartition("@")[2] or None)
    email["Auto-Submitted"] = "auto-generated"
    email.set_content(message.text)
    return email


class DisabledMailDelivery:
    available = False

    def send(self, message: MailMessage) -> None:
        raise MailUnavailableError("Mail delivery is not configured.")


class MemoryMailDelivery:
    """Test adapter: keeps messages in memory. Never touches the network."""

    available = True

    def __init__(self) -> None:
        self.outbox: list[MailMessage] = []
        self.fail_next = False

    def send(self, message: MailMessage) -> None:
        if self.fail_next:
            self.fail_next = False
            raise MailDeliveryError("Simulated delivery failure.")
        self.outbox.append(message)


class FileMailDelivery:
    """Development adapter: one .eml file per message. Refused in production."""

    available = True

    def __init__(self, directory: str, sender: str) -> None:
        self.directory = Path(directory)
        self.sender = sender

    def send(self, message: MailMessage) -> None:
        self.directory.mkdir(parents=True, exist_ok=True)
        path = self.directory / f"{message.kind}-{uuid.uuid4().hex}.eml"
        path.write_bytes(bytes(_envelope(message, self.sender)))
        logger.info("mail.file_written", extra={"kind": message.kind, "file": path.name})


class SmtpMailDelivery:
    """Production SMTP. Bodies are never logged; failures carry no secret."""

    available = True

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def send(self, message: MailMessage) -> None:
        settings = self.settings
        assert settings.smtp_host and settings.mail_from
        email = _envelope(message, settings.mail_from)
        context = ssl.create_default_context()
        try:
            if settings.smtp_security == "ssl":
                client: smtplib.SMTP = smtplib.SMTP_SSL(
                    settings.smtp_host, settings.smtp_port,
                    timeout=settings.smtp_timeout_seconds, context=context,
                )
            else:
                client = smtplib.SMTP(
                    settings.smtp_host, settings.smtp_port, timeout=settings.smtp_timeout_seconds
                )
            with client:
                if settings.smtp_security == "starttls":
                    client.starttls(context=context)
                if settings.smtp_username and settings.smtp_password:
                    client.login(settings.smtp_username, settings.smtp_password.get_secret_value())
                client.send_message(email)
        except (OSError, smtplib.SMTPException) as error:
            logger.warning(
                "mail.smtp_failed", extra={"kind": message.kind, "error": type(error).__name__}
            )
            raise MailDeliveryError("SMTP delivery failed.") from None
        logger.info("mail.sent", extra={"kind": message.kind})


def build_mail_delivery(settings: Settings) -> MailDelivery:
    if settings.mail_backend == "memory":
        return MemoryMailDelivery()
    if settings.mail_backend == "file":
        assert settings.mail_file_dir
        return FileMailDelivery(settings.mail_file_dir, settings.mail_from or "jenkin@localhost")
    if settings.mail_backend == "smtp":
        return SmtpMailDelivery(settings)
    return DisabledMailDelivery()
