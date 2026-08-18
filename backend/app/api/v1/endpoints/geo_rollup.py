from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_geo_scope
from app.core.db import get_db
from app.schemas.enums import RoleCode
from app.schemas.geo_rollup import GeoRollupResponse, PullGeoRollupItemRequest
from app.schemas.regional_status import GeoStatusItemRead
from app.services import geo_rollup as geo_rollup_service

router = APIRouter(prefix="/geos/{geo_id}/rollup", tags=["Geo Reporting"])

_geo_head_write = [Depends(require_geo_scope(RoleCode.GEO_HEAD, RoleCode.ADMIN))]


@router.get("", response_model=GeoRollupResponse)
async def get_geo_rollup(geo_id: UUID, period_id: UUID, db: AsyncSession = Depends(get_db)):
    return await geo_rollup_service.compute_geo_rollup(db, geo_id, period_id)


@router.post(
    "/pull", response_model=GeoStatusItemRead, status_code=status.HTTP_201_CREATED, dependencies=_geo_head_write
)
async def pull_geo_rollup_item(
    geo_id: UUID,
    payload: PullGeoRollupItemRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        return await geo_rollup_service.pull_rollup_item(db, geo_id, payload.account_item_id)
    except geo_rollup_service.RollupItemNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Status item not found for this geo") from exc
    except geo_rollup_service.RollupItemAlreadyHandledError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, "This item has already been pulled or ignored") from exc
