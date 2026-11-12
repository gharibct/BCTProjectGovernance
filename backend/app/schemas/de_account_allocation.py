"""Schemas for DE Account Allocation (account-level Delivery Excellence audit)."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class DeAccountAllocationRow(BaseModel):
    account_id: UUID
    account_name: str
    geo_name: str | None = None
    region_name: str | None = None
    critical_flag: str = "No"
    account_head_name: str | None = None
    project_count: int = 0
    delivery_excellence_id: UUID | None = None
    delivery_excellence_name: str | None = None
    de_allocated_at: datetime | None = None


class DeAccountAssignment(BaseModel):
    account_id: UUID
    # None clears the allocation.
    delivery_excellence_id: UUID | None = None


class DeAccountAllocationBulkAssign(BaseModel):
    assignments: list[DeAccountAssignment] = Field(min_length=1)
