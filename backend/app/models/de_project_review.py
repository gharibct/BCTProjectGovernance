import uuid

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import TimestampColumns, UUIDPrimaryKey


class DeProjectModuleReview(Base, UUIDPrimaryKey, TimestampColumns):
    """Per-module DE Assessor Action for the Project Governance Review workspace
    (design-reference/de-approval). One row per (project, governance module) the
    DE has touched; no row means "Not Reviewed". module_key values come from
    app.schemas.enums.GovernanceModuleKey."""

    __tablename__ = "de_project_module_reviews"

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    module_key: Mapped[str]
    review_action: Mapped[str]  # Not Reviewed, Reviewed, Gap Identified
    remarks: Mapped[str | None]
    updated_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
