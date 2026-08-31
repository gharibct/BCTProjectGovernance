from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, computed_field

from app.schemas.enums import (
    ApplicablePhase,
    BillingType,
    ContractType,
    EngagementType,
    HealthRating,
    ProjectOwned,
    ProjectStatus,
    YesNo,
)


def _is_filled(value: object) -> bool:
    """A str counts as filled only if it has non-whitespace content; any other
    non-None value (UUID, Decimal, date, enum) counts as filled outright."""
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    return True


class ProjectBase(BaseModel):
    project_name: str
    contract_type: ContractType | None = None
    project_type_id: UUID | None = None
    organization_id: UUID | None = None
    project_owned: ProjectOwned | None = None
    geo_id: UUID | None = None
    region_id: UUID | None = None
    account_id: UUID | None = None
    project_manager_id: UUID | None = None
    delivery_manager_id: UUID | None = None
    delivery_excellence_id: UUID | None = None
    customer_overview: str | None = None
    project_scope_description: str | None = None
    project_revenue: Decimal | None = None
    project_currency: str | None = None
    billing_type: BillingType | None = None
    engagement_type: EngagementType | None = None
    critical_flag: YesNo | None = None
    product_flag: YesNo | None = None
    product_id: UUID | None = None  # only meaningful when product_flag == Yes

    planned_start_date: date | None = None
    actual_start_date: date | None = None
    planned_end_date: date | None = None
    actual_end_date: date | None = None

    applicable_phase: ApplicablePhase | None = None


class ProjectCreate(ProjectBase):
    """project_code is server-generated (services.code_generator); health fields
    start unset until a health_declarations / de_assessments record exists."""

    created_by: UUID | None = None


class ProjectUpdate(BaseModel):
    project_name: str | None = None
    contract_type: ContractType | None = None
    project_type_id: UUID | None = None
    organization_id: UUID | None = None
    project_owned: ProjectOwned | None = None
    geo_id: UUID | None = None
    region_id: UUID | None = None
    account_id: UUID | None = None
    project_manager_id: UUID | None = None
    delivery_manager_id: UUID | None = None
    delivery_excellence_id: UUID | None = None
    customer_overview: str | None = None
    project_scope_description: str | None = None
    project_revenue: Decimal | None = None
    project_currency: str | None = None
    billing_type: BillingType | None = None
    engagement_type: EngagementType | None = None
    critical_flag: YesNo | None = None
    product_flag: YesNo | None = None
    product_id: UUID | None = None
    planned_start_date: date | None = None
    actual_start_date: date | None = None
    planned_end_date: date | None = None
    actual_end_date: date | None = None
    applicable_phase: ApplicablePhase | None = None
    project_status: ProjectStatus | None = None
    updated_by: UUID | None = None


class ProjectRead(ProjectBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_code: str
    project_status: ProjectStatus
    planned_duration_days: int | None = None  # DB-computed
    actual_duration_days: int | None = None  # DB-computed
    delivery_declared_overall_health: HealthRating | None = None
    de_assessed_project_health: HealthRating | None = None
    overall_project_health: HealthRating | None = None
    created_by: UUID | None = None
    updated_by: UUID | None = None
    created_at: datetime
    updated_at: datetime

    # Derived, not stored — see new-project-nav.tsx's section status icons.
    # Every field the corresponding charter screen collects must be filled
    # in (not just the Mandatory-badged ones) for that flag to flip true.
    # Saving with blanks is still allowed — this only affects the "done"
    # indicator, never the save itself.
    # delivery_excellence_id is deliberately NOT checked here: the DE is
    # assigned later, on the DE Project Allocation screen (design-reference/
    # de-approval), not by the PM on this charter form.
    @computed_field  # type: ignore[prop-decorator]
    @property
    def profile_completion_flag(self) -> bool:
        base_fields_filled = all(
            _is_filled(value)
            for value in (
                self.project_name,
                self.contract_type,
                self.project_type_id,
                self.project_owned,
                self.organization_id,
                self.geo_id,
                self.region_id,
                self.account_id,
                self.project_manager_id,
                self.delivery_manager_id,
                self.project_revenue,
                self.project_currency,
                self.critical_flag,
                self.product_flag,
            )
        )
        # Product is only collected (and so only required) once Product Flag
        # is Yes — see the Project Profile form's "Product" field.
        product_ok = self.product_flag != YesNo.YES or _is_filled(self.product_id)
        return base_fields_filled and product_ok

    @computed_field  # type: ignore[prop-decorator]
    @property
    def schedule_completion_flag(self) -> bool:
        return all(
            _is_filled(value)
            for value in (
                self.customer_overview,
                self.project_scope_description,
                self.planned_start_date,
                self.planned_end_date,
            )
        )


class ProjectOracleIdBase(BaseModel):
    oracle_project_id: str


class ProjectOracleIdCreate(ProjectOracleIdBase):
    pass


class ProjectOracleIdRead(ProjectOracleIdBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_id: UUID
    created_at: datetime


class ProjectResourceBase(BaseModel):
    resource_name: str
    oracle_resource_id: str | None = None
    role: str | None = None
    fte_allocation: Decimal
    synced_at: datetime | None = None


class ProjectResourceCreate(ProjectResourceBase):
    pass


class ProjectResourceUpdate(BaseModel):
    resource_name: str | None = None
    oracle_resource_id: str | None = None
    role: str | None = None
    fte_allocation: Decimal | None = None
    synced_at: datetime | None = None


class ProjectResourceRead(ProjectResourceBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_id: UUID
    created_at: datetime
    updated_at: datetime


class ProjectResourceSummary(BaseModel):
    """Derived, not stored: head count and total FTE across a project's resources."""

    head_count: int
    total_fte: Decimal
