"""app.core.security scrypt helpers (AUTH_TYPE=password). Pure functions, no
event loop / DB — kept out of test_auth_password.py so the module-level
asyncio mark there doesn't flag them.
"""

from app.core.security import hash_password, verify_password

_PASSWORD = "correct horse battery"


def test_hash_verify_round_trip():
    stored = hash_password(_PASSWORD)
    assert stored.startswith("scrypt$")
    assert verify_password(_PASSWORD, stored) is True
    assert verify_password("other", stored) is False


def test_hashes_are_salted():
    assert hash_password(_PASSWORD) != hash_password(_PASSWORD)


def test_verify_rejects_missing_or_malformed():
    assert verify_password(_PASSWORD, None) is False
    assert verify_password(_PASSWORD, "") is False
    assert verify_password(_PASSWORD, "not-a-hash") is False
    assert verify_password(_PASSWORD, "scrypt$bad$params") is False
    assert verify_password("", hash_password(_PASSWORD)) is False


def test_hash_rejects_empty():
    try:
        hash_password("")
    except ValueError:
        return
    raise AssertionError("expected ValueError for empty password")
