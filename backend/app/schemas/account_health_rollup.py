from uuid import UUID

from pydantic import BaseModel

from app.schemas.enums import Category, RollupStatus


class AccountHealthRollupItem(BaseModel):
    id: UUID  # the source ProjectHealthItem's id
    project_id: UUID
    project_code: str
    project_name: str
    category: Category
    description: str
    account_rollup_status: RollupStatus
    rolled_up_account_item_id: UUID | None


class AccountHealthRollupResponse(BaseModel):
    items: list[AccountHealthRollupItem]


class PullHealthRollupItemRequest(BaseModel):
    project_item_id: UUID
