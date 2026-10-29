from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.enums import QbrStatus


class AccountCustomerCommunicationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    account_id: UUID
    planned_date: date
    actual_date: date | None = None
    status: QbrStatus
    next_qbr_date: date | None = None
    title: str | None = None
    # The stored path is internal; the file is fetched through /{id}/file.
    file_name: str | None = None
    remarks: str | None = None
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime
