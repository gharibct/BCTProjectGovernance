import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric
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
    # Date this geo started being tracked in the tool. NULL = no restriction
    # for reporting "owed" calculations — see services/dashboard.py.
    tool_effective_date: Mapped[date | None]


class Region(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "regions"

    geo_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("geos.id"))
    code: Mapped[str]
    name: Mapped[str]
    is_active: Mapped[bool]


class ProjectType(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "project_types"

    code: Mapped[str] = mapped_column(unique=True)
    name: Mapped[str]
    description: Mapped[str | None]
    is_active: Mapped[bool]


class Product(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "products"

    code: Mapped[str] = mapped_column(unique=True)
    name: Mapped[str]
    is_active: Mapped[bool]


class Account(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "accounts"

    name: Mapped[str] = mapped_column(unique=True)
    geo_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("geos.id"))
    region_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("regions.id"))
    description: Mapped[str | None]  # short summary about the customer
    is_active: Mapped[bool]
    # Date this account started being tracked in the tool. NULL = no
    # restriction for reporting "owed" calculations — see services/dashboard.py.
    tool_effective_date: Mapped[date | None]


class ReportingPeriod(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "reporting_periods"

    period_type: Mapped[str]  # Weekly, Monthly
    code: Mapped[str] = mapped_column(unique=True)  # e.g. '2026-W31', '2026-07'
    label: Mapped[str]  # e.g. 'Week 31, 2026', 'Jul 2026'
    start_date: Mapped[date]
    end_date: Mapped[date]
    is_active: Mapped[bool]


class ExchangeRate(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "exchange_rates"

    currency: Mapped[str] = mapped_column(unique=True)  # ISO code, e.g. EUR
    rate_to_usd: Mapped[Decimal] = mapped_column(Numeric)  # USD per 1 unit of `currency`
