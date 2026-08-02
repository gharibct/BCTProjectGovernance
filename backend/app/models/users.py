import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import TimestampColumns, UUIDPrimaryKey


class Role(Base, UUIDPrimaryKey):
    __tablename__ = "roles"

    code: Mapped[str] = mapped_column(unique=True)  # ADMIN, EXECUTIVE, PROJECT_MANAGER, TEAM_MEMBER, DELIVERY_EXCELLENCE, PMO
    name: Mapped[str]
    description: Mapped[str | None]


class User(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "users"

    ldap_username: Mapped[str] = mapped_column(unique=True)
    full_name: Mapped[str]
    email: Mapped[str] = mapped_column(unique=True)
    role_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("roles.id"))
    is_active: Mapped[bool]
    mfa_enrolled: Mapped[bool]
    mfa_enrolled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
