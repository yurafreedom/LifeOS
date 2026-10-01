"""Outgoing mail behind one delivery interface (JENKIN S1).

Callers build a :class:`MailMessage` and hand it to the application's
:class:`MailDelivery` (``app.state.mail``). Adapters: disabled (nothing can be
sent), memory (tests), file (development .eml files), SMTP (production).
Message bodies may contain single-use secrets (reset / invitation links):
adapters never log a body, and only the development file adapter writes it to
disk.
"""

from app.mail.delivery import (
    DisabledMailDelivery,
    FileMailDelivery,
    MailDelivery,
    MailDeliveryError,
    MailMessage,
    MailUnavailableError,
    MemoryMailDelivery,
    SmtpMailDelivery,
    build_mail_delivery,
)

__all__ = [
    "DisabledMailDelivery",
    "FileMailDelivery",
    "MailDelivery",
    "MailDeliveryError",
    "MailMessage",
    "MailUnavailableError",
    "MemoryMailDelivery",
    "SmtpMailDelivery",
    "build_mail_delivery",
]
