import base64
import hashlib
import hmac
import secrets

from fastapi import Header, HTTPException, status

from app.core.config import settings

API_KEY_HEADER = "X-API-Key"


async def verify_api_key(x_api_key: str | None = Header(default=None, alias=API_KEY_HEADER)) -> None:
    if x_api_key != settings.api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid API key.",
        )


# --- Local password hashing (AUTH_TYPE=password) ---------------------------
#
# Stdlib scrypt so there's no extra dependency. Stored string format:
#   scrypt$<n>$<r>$<p>$<salt_b64>$<hash_b64>
# The parameters are embedded so existing hashes keep verifying if the
# defaults below are raised later.

_SCRYPT_N = 2**15  # CPU/memory cost (OWASP-suggested floor for scrypt)
_SCRYPT_R = 8
_SCRYPT_P = 1
_SALT_BYTES = 16
_KEY_LEN = 32
# scrypt needs maxmem >= roughly 128 * n * r * p; give it headroom.
_MAXMEM = 128 * _SCRYPT_N * _SCRYPT_R * _SCRYPT_P * 2


def _b64(raw: bytes) -> str:
    return base64.b64encode(raw).decode("ascii")


def _derive(password: str, salt: bytes, n: int, r: int, p: int) -> bytes:
    return hashlib.scrypt(
        password.encode("utf-8"), salt=salt, n=n, r=r, p=p, dklen=_KEY_LEN, maxmem=_MAXMEM
    )


def hash_password(password: str) -> str:
    """Return a self-describing scrypt hash string for `password`."""
    if not password:
        raise ValueError("password must not be empty")
    salt = secrets.token_bytes(_SALT_BYTES)
    derived = _derive(password, salt, _SCRYPT_N, _SCRYPT_R, _SCRYPT_P)
    return f"scrypt${_SCRYPT_N}${_SCRYPT_R}${_SCRYPT_P}${_b64(salt)}${_b64(derived)}"


def verify_password(password: str, stored: str | None) -> bool:
    """Constant-time check of `password` against a `hash_password` string.

    Returns False for any malformed or missing hash rather than raising, so
    callers can treat "no password on file" and "wrong password" the same.
    """
    if not password or not stored:
        return False
    try:
        scheme, n_str, r_str, p_str, salt_b64, hash_b64 = stored.split("$")
        if scheme != "scrypt":
            return False
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(hash_b64)
        derived = _derive(password, salt, int(n_str), int(r_str), int(p_str))
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(derived, expected)
