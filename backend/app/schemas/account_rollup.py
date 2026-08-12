from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel

from app.schemas.enums import ProjectStatusCategory, RollupStatus


class AccountRollupMetrics(BaseModel):
    revenue: Decimal | None
    onsite_fte: Decimal | None
    offshore_fte: Decimal | None
    projects_count: int | None
    # How many of the account's projects had a qualifying (non-Draft) report
    # for this period — informational caption only, not itself summed.
    contributing_project_count: int


class AccountRollupItem(BaseModel):
    id: UUID  # the source ProjectStatusItem's id
    project_id: UUID
    project_code: str
    project_name: str
    category: ProjectStatusCategory
    description: str
    account_rollup_status: RollupStatus
    rolled_up_account_item_id: UUID | None


class AccountRollupResponse(BaseModel):
    metrics: AccountRollupMetrics
    items: list[AccountRollupItem]


class PullRollupItemRequest(BaseModel):
    project_item_id: UUID
