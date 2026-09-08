"""Schemas for the New Project Creation flow — an Account Head / Geo Head's
creation request and the DE Project Creation Approval queue that acts on it."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ProjectCreationRequestCreate(BaseModel):
    project_name: str = Field(min_length=1)
    project_manager_id: UUID | None = None
    oracle_project_ids: list[str] = Field(min_length=1)


class ProjectCreationRequestRow(BaseModel):
    id: UUID
    project_name: str
    project_manager_id: UUID | None = None
    project_manager_name: str | None = None
    oracle_project_ids: list[str] = []
    requested_by: UUID | None = None
    requested_by_name: str | None = None
    status: str
    created_at: datetime


class ProjectCreationApproveRequest(BaseModel):
    reviewed_by: UUID
    remarks: str | None = None
