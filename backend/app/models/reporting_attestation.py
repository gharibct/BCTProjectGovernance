import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import TimestampColumns, UUIDPrimaryKey


class MonthlyReportAttestation(Base, UUIDPrimaryKey, TimestampColumns):
    """A PM's "Reviewed and No Changes" sign-off for one Project Performance
    Report section (Measurement / Commitments / Payment Milestones / one of
    the 5 RAIDO logs) for one Monthly reporting period. Only written when the
    PM explicitly attests — a section with data saved that month is complete
    without ever needing a row here (see services/monthly_completion.py)."""

    __tablename__ = "monthly_report_attestations"

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    period_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reporting_periods.id"))
    page_type: Mapped[str]
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    reviewed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
