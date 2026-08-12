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


# Which geo(s)/account(s) a user owns — many-to-many, drives the Geo Head /
# Account Manager dashboard pre-filtering (see services.dashboard).
class UserGeo(Base, UUIDPrimaryKey):
    __tablename__ = "user_geos"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    geo_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("geos.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class UserAccount(Base, UUIDPrimaryKey):
    __tablename__ = "user_accounts"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


# Groundwork only — future project roster for Team Member RAID-item
# assignment scoping; not yet consumed by any dashboard/menu logic.
class UserProject(Base, UUIDPrimaryKey):
    __tablename__ = "user_projects"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
