"""Plain-text security mail, Russian and Ukrainian together (no locale is
known for an anonymous recipient). Links carry the token in the URL fragment,
so it is never sent to a server in a request line or Referer."""

from app.mail.delivery import MailMessage

PRODUCT = "JENKIN"


def password_reset(to: str, link: str, minutes: int) -> MailMessage:
    return MailMessage(
        to=to,
        kind="password_reset",
        subject=f"{PRODUCT}: сброс пароля / скидання пароля",
        text=(
            f"Кто-то (возможно, вы) запросил сброс пароля {PRODUCT}.\n"
            f"Ссылка действует {minutes} мин и работает один раз:\n{link}\n\n"
            "Если вы не запрашивали сброс, просто проигнорируйте письмо — пароль не изменится.\n\n"
            f"Хтось (можливо, ви) запросив скидання пароля {PRODUCT}.\n"
            f"Посилання діє {minutes} хв і працює один раз:\n{link}\n\n"
            "Якщо ви не запитували скидання, просто проігноруйте лист — пароль не зміниться.\n"
        ),
    )


def email_verification(to: str, link: str, hours: int) -> MailMessage:
    return MailMessage(
        to=to,
        kind="email_verification",
        subject=f"{PRODUCT}: подтвердите почту / підтвердьте пошту",
        text=(
            f"Подтвердите, что этот адрес принадлежит вашему аккаунту {PRODUCT}.\n"
            f"Ссылка действует {hours} ч и работает один раз:\n{link}\n\n"
            f"Підтвердьте, що ця адреса належить вашому акаунту {PRODUCT}.\n"
            f"Посилання діє {hours} год і працює один раз:\n{link}\n"
        ),
    )


def invitation(to: str, link: str, days: int) -> MailMessage:
    return MailMessage(
        to=to,
        kind="invitation",
        subject=f"{PRODUCT}: приглашение / запрошення",
        text=(
            f"Вас пригласили создать аккаунт {PRODUCT} для адреса {to}.\n"
            f"Ссылка действует {days} дн. и работает один раз:\n{link}\n\n"
            f"Вас запросили створити акаунт {PRODUCT} для адреси {to}.\n"
            f"Посилання діє {days} дн. і працює один раз:\n{link}\n\n"
            "Если вы не ждали этого письма, проигнорируйте его. / "
            "Якщо ви не чекали цього листа, проігноруйте його.\n"
        ),
    )
