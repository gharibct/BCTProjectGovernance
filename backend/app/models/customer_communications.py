import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, Index, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import TimestampColumns, UUIDPrimaryKey


# Account Reporting -> Update Account QBR (see
# db/tables/54_account_customer_communications.sql): one row per QBR with the
# customer — the account's one open (Initiated / Scheduled) QBR, plus the
# Conducted ones before it. Not period-scoped and not part of the submit/review workflow — it's
# a running history per account. The presentation is stored on disk under
# settings.document_storage_dir.
class AccountCustomerCommunication(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "account_customer_communications"
    # At most one open (Initiated / Scheduled) QBR per account.
    __table_args__ = (
        Index(
            "uq_account_customer_communications_open",
            "account_id",
            unique=True,
            postgresql_where=text("status IN ('Initiated', 'Scheduled')"),
            sqlite_where=text("status IN ('Initiated', 'Scheduled')"),
        ),
    )

    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"))
    planned_date: Mapped[date] = mapped_column(Date)
    actual_date: Mapped[date | None] = mapped_column(Date)  # Conducted only; never in the future
    status: Mapped[str]  # QbrStatus
    next_qbr_date: Mapped[date | None] = mapped_column(Date)  # set only once Conducted
    # Actual date, title and presentation are captured (and mandatory) only for
    # a Conducted QBR.
    title: Mapped[str | None]
    file_name: Mapped[str | None]
    file_path: Mapped[str | None]  # relative to settings.document_storage_dir
    remarks: Mapped[str | None]
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
