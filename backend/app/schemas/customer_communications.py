from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AccountCustomerCommunicationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    account_id: UUID
    reporting_date: date
    title: str
    # The stored path is internal; the file is fetched through /{id}/file.
    file_name: str
    remarks: str | None = None
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime
