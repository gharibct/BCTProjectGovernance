from uuid import UUID

from pydantic import BaseModel


class CopyFromLatestResult(BaseModel):
    # Rows created in the target period; 0 when there was nothing to copy (no
    # earlier report, or every section already had content).
    copied: int
    source_period_id: UUID | None = None
    # Rows in the source period that were left out because that section already
    # had content here. Non-zero means a `replace=true` call would change this
    # period, so the UI asks before doing it.
    skipped: int = 0
