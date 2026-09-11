"""Schemas for the New Project Creation flow — an Account Head / Geo Head's
creation request and the DE Project Creation Approval queue that acts on it."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ProjectCreationRequestCreate(BaseModel):
    project_name: str = Field(min_length=1)
    project_manager_id: UUID | None = None
    # Project profile — mirrors the charter's Org / GEO / Region / Account
    # controls. Required by the form; optional in the schema like
    # project_manager_id, so a partially-filled draft still round-trips.
    organization_id: UUID | None = None
    geo_id: UUID | None = None
    region_id: UUID | None = None
    account_id: UUID | None = None
    oracle_project_ids: list[str] = Field(min_length=1)


class ProjectCreationRequestRow(BaseModel):
    id: UUID
    project_name: str
    project_manager_id: UUID | None = None
    project_manager_name: str | None = None
    organization_id: UUID | None = None
    organization_name: str | None = None
    geo_id: UUID | None = None
    geo_name: str | None = None
    region_id: UUID | None = None
    region_name: str | None = None
    account_id: UUID | None = None
    account_name: str | None = None
    oracle_project_ids: list[str] = []
    requested_by: UUID | None = None
    requested_by_name: str | None = None
    status: str
    review_remarks: str | None = None
    reviewed_at: datetime | None = None
    created_at: datetime


class ProjectCreationApproveRequest(BaseModel):
    reviewed_by: UUID
    remarks: str | None = None


class ProjectCreationRejectRequest(BaseModel):
    reviewed_by: UUID
    # A rejection reason is mandatory — the request row is retained as "Rejected"
    # so the requester can see why it was turned down.
    remarks: str = Field(min_length=1)
