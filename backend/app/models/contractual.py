import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import TimestampColumns, UUIDPrimaryKey


class ContractualCommitment(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "contractual_commitments"

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    frequency: Mapped[str]  # One Time, Weekly, Fortnight, Monthly, Quarterly, Half Yearly, Phase Wise
    commitment_name: Mapped[str]
    formula: Mapped[str | None]
    target: Mapped[str | None]
    penalty_applicable: Mapped[bool]
    penalty_value: Mapped[Decimal | None] = mapped_column(Numeric)


class ContractualCommitmentActual(Base, UUIDPrimaryKey):
    __tablename__ = "contractual_commitment_actuals"

    commitment_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("contractual_commitments.id", ondelete="CASCADE")
    )
    period_date: Mapped[date]
    actual_value: Mapped[str | None]
    met_status: Mapped[str | None]  # Met, Not Met
    recorded_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class MilestonePayment(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "milestone_payments"

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    milestone_name: Mapped[str]
    milestone_description: Mapped[str | None]
    expected_date_of_payment: Mapped[date | None]
    expected_payment_value: Mapped[Decimal | None] = mapped_column(Numeric)


class MilestonePaymentActual(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "milestone_payment_actuals"

    milestone_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("milestone_payments.id", ondelete="CASCADE"), unique=True
    )
    actual_date_of_payment: Mapped[date | None]
    actual_payment_value: Mapped[Decimal | None] = mapped_column(Numeric)
    status: Mapped[str | None]  # Paid On Time, Delayed Payment, Yet To Be Paid
    remarks: Mapped[str | None]
