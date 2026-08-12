from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel

from app.schemas.enums import ProjectStatusCategory, RollupStatus


class GeoRollupMetrics(BaseModel):
    revenue: Decimal | None
    onsite_fte: Decimal | None
    offshore_fte: Decimal | None
    projects_count: int | None
    # How many of the geo's accounts had a qualifying (non-Draft) report for
    # this period — informational caption only, not itself summed.
    contributing_account_count: int


class GeoRollupItem(BaseModel):
    id: UUID  # the source AccountStatusItem's id
    account_id: UUID
    account_name: str
    category: ProjectStatusCategory
    description: str
    account_rollup_status: RollupStatus
    rolled_up_geo_item_id: UUID | None


class GeoRollupResponse(BaseModel):
    metrics: GeoRollupMetrics
    items: list[GeoRollupItem]


class PullGeoRollupItemRequest(BaseModel):
    account_item_id: UUID
