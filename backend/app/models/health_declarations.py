import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import UUIDPrimaryKey


class HealthDeclaration(Base, UUIDPrimaryKey):
    __tablename__ = "health_declarations"

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    period_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reporting_periods.id"))

    # Rating values (all *_rating columns): Red, Potential Red, Amber, Green.
    core_delivery_rating: Mapped[str]
    core_delivery_description: Mapped[str | None]
    people_rating: Mapped[str]
    people_description: Mapped[str | None]
    operational_rating: Mapped[str]
    operational_description: Mapped[str | None]
    customer_rating: Mapped[str]
    customer_description: Mapped[str | None]
    financial_rating: Mapped[str]
    financial_description: Mapped[str | None]
    compliance_rating: Mapped[str]
    compliance_description: Mapped[str | None]

    overall_rating: Mapped[str]  # computed by services.health_rollup

    declared_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
