from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.enums import Category, HealthRating


class AccountHealthDeclarationCreate(BaseModel):
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
    # computes it from the six category ratings above.


class AccountHealthDeclarationUpdate(BaseModel):
    """A re-declaration for a period that already has one is an edit, not a
    new row — one declaration per account+period (see
    04_account_health_declarations.sql)."""

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


class AccountHealthDeclarationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    account_id: UUID
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


class AccountHealthItemCreate(BaseModel):
    period_id: UUID
    category: Category
    description: str


class AccountHealthItemUpdate(BaseModel):
    description: str


class AccountHealthItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    account_id: UUID
    period_id: UUID
    category: Category
    description: str
    created_at: datetime
    updated_at: datetime
