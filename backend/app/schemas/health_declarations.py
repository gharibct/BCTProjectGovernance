from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.enums import Category, HealthRating, RollupStatus


class HealthDeclarationCreate(BaseModel):
    period_id: UUID
    core_delivery_rating: HealthRating
    core_delivery_description: str | None = None
    people_rating: HealthRating
    people_description: str | None = None
    operational_rating: HealthRating
    operational_description: str | None = None
    customer_rating: HealthRating
    customer_description: str | None = None
    financial_rating: HealthRating
    financial_description: str | None = None
    compliance_rating: HealthRating
    compliance_description: str | None = None
    declared_by: UUID | None = None
    # overall_rating is NOT accepted from the client — services.health_rollup
    # computes it from the six category ratings above (UX §4.3: "if any one
    # category is Red, the overall is Red").


class HealthDeclarationUpdate(BaseModel):
    """A re-declaration for a period that already has one is an edit, not a
    new row — one declaration per project+period (see 04_health_declarations.sql)."""

    core_delivery_rating: HealthRating
    core_delivery_description: str | None = None
    people_rating: HealthRating
    people_description: str | None = None
    operational_rating: HealthRating
    operational_description: str | None = None
    customer_rating: HealthRating
    customer_description: str | None = None
    financial_rating: HealthRating
    financial_description: str | None = None
    compliance_rating: HealthRating
    compliance_description: str | None = None
    declared_by: UUID | None = None


class HealthDeclarationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_id: UUID
    period_id: UUID
    core_delivery_rating: HealthRating
    core_delivery_description: str | None = None
    people_rating: HealthRating
    people_description: str | None = None
    operational_rating: HealthRating
    operational_description: str | None = None
    customer_rating: HealthRating
    customer_description: str | None = None
    financial_rating: HealthRating
    financial_description: str | None = None
    compliance_rating: HealthRating
    compliance_description: str | None = None
    overall_rating: HealthRating
    declared_by: UUID | None = None
    created_at: datetime


class ProjectHealthItemCreate(BaseModel):
    period_id: UUID
    category: Category
    description: str


class ProjectHealthItemUpdate(BaseModel):
    description: str


class ProjectHealthItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_id: UUID
    period_id: UUID
    category: Category
    description: str
    account_rollup_status: RollupStatus
    rolled_up_account_item_id: UUID | None = None
    created_at: datetime
    updated_at: datetime


class ProjectHealthItemRollupStatusUpdate(BaseModel):
    # Pulled is never client-settable — only the pull action sets it.
    status: Literal[RollupStatus.PENDING, RollupStatus.IGNORED]
