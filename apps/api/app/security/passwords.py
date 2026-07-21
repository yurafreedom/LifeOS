from pwdlib import PasswordHash

_PASSWORD_HASH = PasswordHash.recommended()
_DUMMY_HASH = _PASSWORD_HASH.hash("lifeos-dummy-password-for-timing-equalization")


def normalize_email(value: str) -> str:
    return value.strip().casefold()


def hash_password(password: str) -> str:
    return _PASSWORD_HASH.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _PASSWORD_HASH.verify(password, password_hash)
    except (TypeError, ValueError):
        return False


def verify_password_or_dummy(password: str, password_hash: str | None) -> bool:
    if password_hash is None:
        _PASSWORD_HASH.verify(password, _DUMMY_HASH)
        return False
    return verify_password(password, password_hash)
