"""Encryption helpers for data protected at rest (biometric templates, camera passwords)."""

from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings


class EncryptionNotConfigured(RuntimeError):
    pass


@lru_cache(maxsize=1)
def _fernet() -> Fernet:
    key = settings.SMARTFACE_ENCRYPTION_KEY
    if not key or key.startswith("replace-with"):
        raise EncryptionNotConfigured(
            "SMARTFACE_ENCRYPTION_KEY is not configured. Generate one with "
            "`python manage.py generate_encryption_key` and add it to backend/.env."
        )
    try:
        return Fernet(key.encode())
    except ValueError as exc:
        raise EncryptionNotConfigured("SMARTFACE_ENCRYPTION_KEY is not a valid Fernet key.") from exc


def encryption_configured() -> bool:
    try:
        _fernet()
        return True
    except EncryptionNotConfigured:
        return False


def encrypt_bytes(data: bytes) -> bytes:
    return _fernet().encrypt(data)


def decrypt_bytes(token: bytes) -> bytes:
    try:
        return _fernet().decrypt(bytes(token))
    except InvalidToken as exc:
        raise EncryptionNotConfigured(
            "Stored data could not be decrypted. SMARTFACE_ENCRYPTION_KEY may have changed."
        ) from exc


def encrypt_text(value: str) -> str:
    return encrypt_bytes(value.encode()).decode()


def decrypt_text(token: str) -> str:
    return decrypt_bytes(token.encode()).decode()
