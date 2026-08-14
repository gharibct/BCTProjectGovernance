import uuid

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import TimestampColumns, UUIDPrimaryKey
from app.models.types import PortableJSON


# Geo Head's Executive Update for CXO (see db/tables/43_executive_updates.sql)
# — free-form Delivery/People/Financials/Operations content, independent of
# GeoStatusReport (regional_status.py). `content` is the whole
# { sections: [...] } document as authored by ExecutiveContentBuilder on the
# frontend, stored as-is rather than normalized into section/block tables.
class ExecutiveUpdate(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "executive_updates"

    geo_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("geos.id", ondelete="CASCADE"))
    period_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reporting_periods.id"))
    status: Mapped[str]  # Draft, Submitted, Approved, Rejected — stays Draft this pass
    content: Mapped[dict] = mapped_column(PortableJSON)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
