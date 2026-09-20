from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator

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
    tool_effective_date: date | None = None


class GeoCreate(GeoBase):
    pass


class GeoUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    is_active: bool | None = None
    tool_effective_date: date | None = None


class GeoRead(GeoBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID


class RegionBase(BaseModel):
    geo_id: UUID
    code: str
    name: str
    is_active: bool = True


class RegionCreate(RegionBase):
    pass


class RegionUpdate(BaseModel):
    geo_id: UUID | None = None
    code: str | None = None
    name: str | None = None
    is_active: bool | None = None


class RegionRead(RegionBase):
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


class ProductBase(BaseModel):
    code: str
    name: str
    is_active: bool = True


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    is_active: bool | None = None


class ProductRead(ProductBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID


class AccountBase(BaseModel):
    name: str
    geo_id: UUID | None = None
    region_id: UUID | None = None
    description: str | None = None
    is_active: bool = True
    tool_effective_date: date | None = None


class AccountCreate(AccountBase):
    pass


class AccountUpdate(BaseModel):
    name: str | None = None
    geo_id: UUID | None = None
    region_id: UUID | None = None
    description: str | None = None
    is_active: bool | None = None
    tool_effective_date: date | None = None


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


class ExchangeRateWrite(BaseModel):
    currency: str
    rate_to_usd: Decimal

    @field_validator("currency")
    @classmethod
    def _currency_code(cls, value: str) -> str:
        code = value.strip().upper()
        if len(code) != 3 or not code.isalpha():
            raise ValueError("Currency must be a 3-letter code")
        if code == "USD":
            raise ValueError("USD needs no exchange rate")
        return code

    @field_validator("rate_to_usd")
    @classmethod
    def _positive_rate(cls, value: Decimal) -> Decimal:
        if value <= 0:
            raise ValueError("Exchange rate must be greater than 0")
        return value


class ExchangeRateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    currency: str
    rate_to_usd: Decimal
    updated_at: datetime
