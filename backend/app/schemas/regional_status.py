from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.enums import ProjectStatusCategory, ReportStatus, RollupStatus


class AccountStatusReportCreate(BaseModel):
    period_id: UUID
    status: ReportStatus = ReportStatus.DRAFT
    revenue: Decimal | None = None
    onsite_fte: Decimal | None = None
    offshore_fte: Decimal | None = None
    projects_count: int | None = None
    key_accomplishments: str | None = None
    upcoming_key_releases: str | None = None
    leadership_support_required: str | None = None
    created_by: UUID | None = None


class AccountStatusReportUpdate(BaseModel):
    status: ReportStatus | None = None
    revenue: Decimal | None = None
    onsite_fte: Decimal | None = None
    offshore_fte: Decimal | None = None
    projects_count: int | None = None
    key_accomplishments: str | None = None
    upcoming_key_releases: str | None = None
    leadership_support_required: str | None = None


class AccountStatusReportRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    account_id: UUID
    period_id: UUID
    status: ReportStatus
    revenue: Decimal | None = None
    onsite_fte: Decimal | None = None
    offshore_fte: Decimal | None = None
    projects_count: int | None = None
    key_accomplishments: str | None = None
    upcoming_key_releases: str | None = None
    leadership_support_required: str | None = None
    created_by: UUID | None = None
    reviewed_by: UUID | None = None
    reviewed_at: datetime | None = None
    review_comment: str | None = None
    created_at: datetime
    updated_at: datetime


class GeoStatusReportCreate(BaseModel):
    period_id: UUID
    status: ReportStatus = ReportStatus.DRAFT
    revenue: Decimal | None = None
    onsite_fte: Decimal | None = None
    offshore_fte: Decimal | None = None
    projects_count: int | None = None
    key_accomplishments: str | None = None
    upcoming_key_releases: str | None = None
    leadership_support_required: str | None = None
    created_by: UUID | None = None


class GeoStatusReportUpdate(BaseModel):
    status: ReportStatus | None = None
    revenue: Decimal | None = None
    onsite_fte: Decimal | None = None
    offshore_fte: Decimal | None = None
    projects_count: int | None = None
    key_accomplishments: str | None = None
    upcoming_key_releases: str | None = None
    leadership_support_required: str | None = None


class GeoStatusReportRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    geo_id: UUID
    period_id: UUID
    status: ReportStatus
    revenue: Decimal | None = None
    onsite_fte: Decimal | None = None
    offshore_fte: Decimal | None = None
    projects_count: int | None = None
    key_accomplishments: str | None = None
    upcoming_key_releases: str | None = None
    leadership_support_required: str | None = None
    created_by: UUID | None = None
    reviewed_by: UUID | None = None
    reviewed_at: datetime | None = None
    review_comment: str | None = None
    created_at: datetime
    updated_at: datetime


class AccountStatusItemCreate(BaseModel):
    period_id: UUID
    category: ProjectStatusCategory
    description: str


class AccountStatusItemUpdate(BaseModel):
    description: str


class AccountStatusItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    account_id: UUID
    period_id: UUID
    category: ProjectStatusCategory
    description: str
    account_rollup_status: RollupStatus
    rolled_up_geo_item_id: UUID | None = None
    created_at: datetime
    updated_at: datetime


class AccountStatusItemRollupStatusUpdate(BaseModel):
    # Pulled is never client-settable — only the pull action sets it.
    status: Literal[RollupStatus.PENDING, RollupStatus.IGNORED]


class GeoStatusItemCreate(BaseModel):
    period_id: UUID
    category: ProjectStatusCategory
    description: str


class GeoStatusItemUpdate(BaseModel):
    description: str


class GeoStatusItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    geo_id: UUID
    period_id: UUID
    category: ProjectStatusCategory
    description: str
    created_at: datetime
    updated_at: datetime
