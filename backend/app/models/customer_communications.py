import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import TimestampColumns, UUIDPrimaryKey


# Account Reporting -> Customer Communications (see
# db/tables/54_account_customer_communications.sql): one row per meeting /
# presentation shared with the customer. Not period-scoped and not part of the
# submit/review workflow — it's a running history per account. The presentation
# is stored on disk under settings.document_storage_dir.
class AccountCustomerCommunication(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "account_customer_communications"

    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"))
    reporting_date: Mapped[date] = mapped_column(Date)
    title: Mapped[str]
    file_name: Mapped[str]
    file_path: Mapped[str]  # relative to settings.document_storage_dir
    remarks: Mapped[str | None]
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
