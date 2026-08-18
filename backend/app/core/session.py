from datetime import datetime, timedelta, timezone
from uuid import UUID

import jwt

from app.core.config import settings

SESSION_COOKIE_NAME = "pg_session"
_ALGORITHM = "HS256"


def create_session_token(user_id: UUID) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(minutes=settings.session_ttl_minutes),
    }
    return jwt.encode(payload, settings.session_secret, algorithm=_ALGORITHM)


def decode_session_token(token: str) -> UUID | None:
    try:
        payload = jwt.decode(token, settings.session_secret, algorithms=[_ALGORITHM])
        return UUID(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None
