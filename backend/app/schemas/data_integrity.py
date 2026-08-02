from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.enums import ExpectedCadence


class DataIntegrityChecklistItemCreate(BaseModel):
    module_name: str
    item_name: str
    expected_cadence: ExpectedCadence
    is_active: bool = True


class DataIntegrityChecklistItemUpdate(BaseModel):
    module_name: str | None = None
    item_name: str | None = None
    expected_cadence: ExpectedCadence | None = None
    is_active: bool | None = None


class DataIntegrityChecklistItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    module_name: str
    item_name: str
    expected_cadence: ExpectedCadence
    is_active: bool
    created_at: datetime


class DataIntegrityStatusRow(BaseModel):
    """One row of the computed rollup (UX §4.13) — not stored, derived at
    query time from the other module tables for a given project."""

    module_name: str
    item_name: str
    expected_cadence: ExpectedCadence
    last_updated_date: date | None
    is_updated: bool
