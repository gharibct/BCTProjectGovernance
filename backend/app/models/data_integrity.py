from datetime import datetime

from sqlalchemy import DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import UUIDPrimaryKey


class DataIntegrityChecklistItem(Base, UUIDPrimaryKey):
    __tablename__ = "data_integrity_checklist_items"

    module_name: Mapped[str]
    item_name: Mapped[str]
    expected_cadence: Mapped[str]  # Weekly, Monthly, Quarterly, Ad Hoc
    is_active: Mapped[bool]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
