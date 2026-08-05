from datetime import date
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.enums import PeriodType


class OrganizationBase(BaseModel):
    code: str
    name: str
    is_active: bool = True


class OrganizationCreate(OrganizationBase):
    pass


class OrganizationUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    is_active: bool | None = None


class OrganizationRead(OrganizationBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID


class GeoBase(BaseModel):
    code: str
    name: str
    is_active: bool = True


class GeoCreate(GeoBase):
    pass


class GeoUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    is_active: bool | None = None


class GeoRead(GeoBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID


class ProjectTypeBase(BaseModel):
    code: str
    name: str
    description: str | None = None
    is_active: bool = True


class ProjectTypeCreate(ProjectTypeBase):
    pass


class ProjectTypeUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    description: str | None = None
    is_active: bool | None = None


class ProjectTypeRead(ProjectTypeBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID


class AccountBase(BaseModel):
    name: str
    geo_id: UUID | None = None
    is_active: bool = True


class AccountCreate(AccountBase):
    pass


class AccountUpdate(BaseModel):
    name: str | None = None
    geo_id: UUID | None = None
    is_active: bool | None = None


class AccountRead(AccountBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID


class ReportingPeriodBase(BaseModel):
    period_type: PeriodType
    code: str
    label: str
    start_date: date
    end_date: date
    is_active: bool = True


class ReportingPeriodCreate(ReportingPeriodBase):
    pass


class ReportingPeriodUpdate(BaseModel):
    period_type: PeriodType | None = None
    code: str | None = None
    label: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    is_active: bool | None = None


class ReportingPeriodRead(ReportingPeriodBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
