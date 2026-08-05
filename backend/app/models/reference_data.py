import uuid
from datetime import date

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import TimestampColumns, UUIDPrimaryKey


class Organization(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "organizations"

    code: Mapped[str] = mapped_column(unique=True)  # BCTPL, BCTC, FT
    name: Mapped[str]
    is_active: Mapped[bool]


class Geo(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "geos"

    code: Mapped[str] = mapped_column(unique=True)  # APAC, MEA, US
    name: Mapped[str]
    is_active: Mapped[bool]


class ProjectType(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "project_types"

    code: Mapped[str] = mapped_column(unique=True)
    name: Mapped[str]
    description: Mapped[str | None]
    is_active: Mapped[bool]


class Account(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "accounts"

    name: Mapped[str] = mapped_column(unique=True)
    geo_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("geos.id"))
    is_active: Mapped[bool]


class ReportingPeriod(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "reporting_periods"

    period_type: Mapped[str]  # Weekly, Monthly
    code: Mapped[str] = mapped_column(unique=True)  # e.g. '2026-W31', '2026-07'
    label: Mapped[str]  # e.g. 'Week 31, 2026', 'Jul 2026'
    start_date: Mapped[date]
    end_date: Mapped[date]
    is_active: Mapped[bool]
